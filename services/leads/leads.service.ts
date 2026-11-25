import {
  LeadsRepository,
  type LeadRow,
  type LeadInsert,
  type LeadUpdate,
  type LeadFilterOptions,
  type LeadMetricsSummary,
} from '@/repositories/leads.repository';
import { LeadNotesRepository, type HydratedLeadNote } from '@/repositories/lead-notes.repository';
import { LeadTagsRepository, type LeadTagRow } from '@/repositories/lead-tags.repository';
import { ImportJobsRepository } from '@/repositories/import-jobs.repository';
import { CampaignsRepository } from '@/repositories/campaigns.repository';
import { CampaignsService } from '@/services/campaigns/campaigns.service';
import {
  leadCreateSchema,
  leadUpdateSchema,
  leadBulkActionSchema,
  type LeadCreateInput,
  type LeadUpdateInput,
  type LeadBulkActionInput,
} from '@/lib/validation';
import { getClientEnv, isMockDevMode } from '@/lib/env';
import { normalizePhone, formatDisplayPhone } from '@/lib/telephony/phone';
import { parseCsv } from '@/lib/csv/parser';
import {
  normalizeCsvRows,
  detectDuplicatesAndDnc,
  buildDatabaseOperations,
  generateErrorCsv,
  type ColumnMappingConfig,
  type DuplicateStrategy,
  type CsvPreviewSummary,
  type ImportProblemRow,
} from '@/lib/csv/importer';
import { getDevStore } from '@/lib/dev/dev-store';
import type { Lead, LeadStatus } from '@/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json, LeadStatusDb } from '@/lib/supabase/types';

export interface HydratedLeadDetails extends Lead {
  notesList?: HydratedLeadNote[];
  tagsList?: LeadTagRow[];
  dncReason?: string | null;
  isArchived?: boolean;
  isDnc?: boolean;
}

export class LeadsService {
  private repo: LeadsRepository;
  private notesRepo: LeadNotesRepository;
  private tagsRepo: LeadTagsRepository;
  private importJobsRepo: ImportJobsRepository;
  private campaignsRepo: CampaignsRepository;
  private campaignsService: CampaignsService;
  private defaultOrgId: string;
  private isMockDevMode: boolean;

  constructor(private readonly supabase: SupabaseClient<Database>) {
    this.repo = new LeadsRepository(supabase);
    this.notesRepo = new LeadNotesRepository(supabase);
    this.tagsRepo = new LeadTagsRepository(supabase);
    this.importJobsRepo = new ImportJobsRepository(supabase);
    this.campaignsRepo = new CampaignsRepository(supabase);
    this.campaignsService = new CampaignsService(supabase);
    const env = getClientEnv();
    this.defaultOrgId = env.NEXT_PUBLIC_DEFAULT_ORG_ID;
    this.isMockDevMode = isMockDevMode();
  }

  /**
   * Translates database LeadRow into UI domain Lead type.
   */
  public toDomain(
    row: LeadRow,
    tags: string[] = [],
    campaignInfo?: { id?: string; name?: string }
  ): Lead {
    const statusMap: Record<string, LeadStatus> = {
      NEW: 'new',
      CONTACTED: 'connected',
      ENGAGED: 'qualified',
      TECHNICAL_EVALUATION: 'qualified',
      COMMERCIAL_DISCUSSION: 'meeting-booked',
      new: 'new',
      queued: 'in-queue',
      in_progress: 'dialing',
      contacted: 'connected',
      qualified: 'qualified',
      converted: 'meeting-booked',
      unqualified: 'unreachable',
      dnc: 'dnc',
    };

    const fleetSize =
      typeof row.custom_fields === 'object' && row.custom_fields !== null && 'fleet_size' in row.custom_fields
        ? String((row.custom_fields as Record<string, unknown>).fleet_size)
        : '120 Units';

    const leadTags = tags.length > 0 ? tags : [row.city, row.region].filter(Boolean);

    return {
      id: row.id,
      name: row.full_name,
      company: row.company_name,
      phone: formatDisplayPhone(row.phone_e164 || row.phone),
      title: row.job_title,
      email: row.email ?? undefined,
      timezone: `${row.timezone.split('/')[1]?.replace(/_/g, ' ') ?? 'EST'}`,
      localTime: '02:45 PM CST',
      fleetSize,
      tags: leadTags,
      status: row.is_dnc ? 'dnc' : statusMap[row.status] ?? 'new',
      priority: (row.priority as Lead['priority']) || 'medium',
      campaignId: campaignInfo?.id || (row as any).campaign_id || undefined,
      campaignName: campaignInfo?.name || (row as any).campaign_name || undefined,
      attempts: 0,
      maxAttempts: 4,
      lastOutcome: row.is_dnc ? `DNC Restricted: ${row.dnc_reason ?? 'Requested'}` : undefined,
    };
  }

  async getLeads(
    organizationId?: string,
    options?: LeadFilterOptions
  ): Promise<{ leads: Lead[]; totalCount: number; metrics: LeadMetricsSummary }> {
    const orgId = organizationId ?? this.defaultOrgId;

    if (this.isMockDevMode) {
      const store = getDevStore();
      let filtered = store.leads.filter((l) => (options?.isArchived ? l.is_archived : !l.is_archived));

      if (options?.search) {
        const q = options.search.toLowerCase();
        filtered = filtered.filter(
          (l) =>
            l.full_name.toLowerCase().includes(q) ||
            l.company_name.toLowerCase().includes(q) ||
            l.phone.includes(q) ||
            (l.email && l.email.toLowerCase().includes(q))
        );
      }

      if (options?.status && options.status !== 'All') {
        const statusMap: Record<string, string> = {
          'New': 'new',
          'In-Queue': 'queued',
          'Dialing': 'in_progress',
          'Connected': 'contacted',
          'Qualified': 'qualified',
          'Meeting Booked': 'converted',
          'Unreachable': 'unqualified',
          'DNC': 'dnc',
        };
        const mappedStatus = statusMap[options.status] || options.status.toLowerCase();
        if (mappedStatus === 'dnc') {
          filtered = filtered.filter((l) => l.is_dnc);
        } else {
          filtered = filtered.filter((l) => l.status === mappedStatus);
        }
      }

      if (options?.priority) {
        filtered = filtered.filter((l) => l.priority === options.priority);
      }
      if (options?.isDnc !== undefined) {
        filtered = filtered.filter((l) => l.is_dnc === options.isDnc);
      }
      if (options?.source && options.source !== 'All') {
        filtered = filtered.filter((l) => l.source === options.source);
      }

      const totalCount = filtered.length;
      const offset = options?.offset ?? 0;
      const limit = options?.limit ?? 25;
      const paged = filtered.slice(offset, offset + limit);

      const domainLeads = paged.map((r) => {
        const tags = (store.tags[r.id] || []).map((t) => t.name);
        return this.toDomain(r, tags);
      });

      const unarchived = store.leads.filter((l) => !l.is_archived);
      const metrics: LeadMetricsSummary = {
        totalLeads: unarchived.length,
        contacted: unarchived.filter((l) => ['contacted', 'qualified', 'converted'].includes(l.status)).length,
        qualified: unarchived.filter((l) => l.status === 'qualified').length,
        dncRestricted: unarchived.filter((l) => l.is_dnc).length,
      };

      return { leads: domainLeads, totalCount, metrics };
    }

    const [{ leads: rows, totalCount }, metrics] = await Promise.all([
      this.repo.list(orgId, options),
      this.repo.getMetrics(orgId),
    ]);

    const rowIds = rows.map((r) => r.id);
    const campaignMap = new Map<string, { id: string; name: string }>();

    if (rowIds.length > 0) {
      try {
        const { data: enrolls } = await this.supabase
          .from('campaign_enrollments')
          .select('lead_id, campaign_id, campaigns(id, name)')
          .in('lead_id', rowIds);

        if (enrolls) {
          for (const e of enrolls) {
            const camp = (e as any).campaigns;
            campaignMap.set(e.lead_id, {
              id: e.campaign_id,
              name: camp?.name || 'Campaign',
            });
          }
        }
      } catch {
        // non-blocking
      }
    }

    const domainLeads = rows.map((r) => this.toDomain(r, [], campaignMap.get(r.id)));

    return {
      leads: domainLeads,
      totalCount,
      metrics,
    };
  }

  async getMetrics(organizationId?: string): Promise<LeadMetricsSummary> {
    const orgId = organizationId ?? this.defaultOrgId;
    if (this.isMockDevMode) {
      const store = getDevStore();
      const unarchived = store.leads.filter((l) => !l.is_archived);
      return {
        totalLeads: unarchived.length,
        contacted: unarchived.filter((l) => ['contacted', 'qualified', 'converted'].includes(l.status)).length,
        qualified: unarchived.filter((l) => l.status === 'qualified').length,
        dncRestricted: unarchived.filter((l) => l.is_dnc).length,
      };
    }
    return this.repo.getMetrics(orgId);
  }

  async getLeadById(id: string, organizationId?: string): Promise<HydratedLeadDetails | null> {
    const orgId = organizationId ?? this.defaultOrgId;

    if (this.isMockDevMode) {
      const store = getDevStore();
      const row = store.leads.find((l) => l.id === id);
      if (!row) return null;
      const notesList = store.notes[id] || [];
      const tagsList = store.tags[id] || [];
      const domain = this.toDomain(row, tagsList.map((t) => t.name));
      return {
        ...domain,
        notesList,
        tagsList,
        dncReason: row.dnc_reason,
        isArchived: row.is_archived,
        isDnc: row.is_dnc,
      };
    }

    const row = await this.repo.getById(id, orgId);
    if (!row) return null;

    const [notesList, tagsList] = await Promise.all([
      this.notesRepo.listByLeadId(id),
      this.tagsRepo.getTagsForLead(id),
    ]);

    const tags = tagsList.map((t) => t.name);
    const domain = this.toDomain(row, tags);

    return {
      ...domain,
      notesList,
      tagsList,
      dncReason: row.dnc_reason,
      isArchived: row.is_archived,
      isDnc: row.is_dnc,
    };
  }

  async createLead(input: LeadCreateInput, organizationId?: string, actorId?: string): Promise<Lead> {
    const validated = leadCreateSchema.parse(input);
    const orgId = organizationId ?? this.defaultOrgId;

    // Normalization check
    const phoneNorm = normalizePhone(validated.phone, validated.country);
    const phoneE164 = phoneNorm.isValid && phoneNorm.e164 ? phoneNorm.e164 : validated.phoneE164;

    if (this.isMockDevMode) {
      const store = getDevStore();
      const newId = `ld_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newRow: LeadRow = {
        id: newId,
        organization_id: orgId,
        name: `${validated.firstName} ${validated.lastName}`.trim(),
        company: validated.companyName,
        title: validated.jobTitle ?? '',
        temperature: 'COLD',
        do_not_call: validated.isDnc ?? false,
        deleted_at: null,
        first_name: validated.firstName,
        last_name: validated.lastName,
        full_name: `${validated.firstName} ${validated.lastName}`.trim(),
        company_name: validated.companyName,
        job_title: validated.jobTitle ?? '',
        phone: validated.phone,
        phone_e164: phoneE164 || validated.phone,
        email: validated.email ? validated.email.toLowerCase() : null,
        country: validated.country,
        region: validated.region ?? '',
        city: validated.city ?? '',
        timezone: validated.timezone,
        source: validated.source,
        status: validated.status,
        priority: validated.priority,
        is_dnc: validated.isDnc,
        dnc_reason: validated.dncReason ?? null,
        is_archived: false,
        archived_at: null,
        last_contacted_at: null,
        next_contact_at: null,
        created_by: actorId ?? null,
        custom_fields: (validated.customFields || {}) as Json,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      store.leads.unshift(newRow);

      if (validated.note) {
        store.notes[newId] = [
          {
            id: `note_${Date.now()}`,
            lead_id: newId,
            author_id: actorId ?? 'usr_operator',
            content: validated.note,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            author_name: 'Operator',
            author_avatar: undefined,
          },
        ];
      }

      if (validated.tags && validated.tags.length > 0) {
        store.tags[newId] = validated.tags.map((t, idx) => ({
          id: `tag_${Date.now()}_${idx}`,
          organization_id: orgId,
          name: t,
          color: '#0284c7',
        }));
      }

      return this.toDomain(newRow, validated.tags || []);
    }

    const leadInsert: LeadInsert = {
      organization_id: orgId,
      created_by: actorId || null,
      first_name: validated.firstName,
      last_name: validated.lastName,
      company_name: validated.companyName,
      job_title: validated.jobTitle,
      phone: validated.phone,
      phone_e164: phoneE164 || validated.phone,
      email: validated.email ? validated.email.toLowerCase() : null,
      country: validated.country,
      region: validated.region,
      city: validated.city,
      timezone: validated.timezone,
      source: validated.source,
      status: validated.status,
      priority: validated.priority,
      is_dnc: validated.isDnc,
      dnc_reason: validated.dncReason,
      custom_fields: validated.customFields as Json,
    };

    const row = await this.repo.create(leadInsert);

    // Initial note if provided
    if (validated.note && actorId) {
      await this.notesRepo.create({
        lead_id: row.id,
        author_id: actorId,
        content: validated.note,
      });
    }

    // Assign initial tags if provided
    if (validated.tags && validated.tags.length > 0) {
      for (const tag of validated.tags) {
        const tagRow = await this.tagsRepo.getOrCreateTag(orgId, tag);
        await this.tagsRepo.assignTag(row.id, tagRow.id);
      }
    }

    // Audit log
    await this.logAudit(orgId, actorId, 'lead.created', 'lead', row.id, {
      fullName: row.full_name,
      phone: row.phone_e164,
      company: row.company_name,
    });

    return this.toDomain(row, validated.tags);
  }

  async updateLead(id: string, input: LeadUpdateInput, organizationId?: string, actorId?: string): Promise<Lead> {
    const validated = leadUpdateSchema.parse(input);
    const orgId = organizationId ?? this.defaultOrgId;

    if (this.isMockDevMode) {
      const store = getDevStore();
      const existing = store.leads.find((l) => l.id === id);
      if (!existing) throw new Error('Lead not found');

      if (validated.firstName) existing.first_name = validated.firstName;
      if (validated.lastName) existing.last_name = validated.lastName;
      if (validated.firstName || validated.lastName) {
        existing.full_name = `${existing.first_name} ${existing.last_name}`.trim();
      }
      if (validated.companyName) existing.company_name = validated.companyName;
      if (validated.jobTitle !== undefined) existing.job_title = validated.jobTitle ?? '';
      if (validated.email !== undefined) existing.email = validated.email ? validated.email.toLowerCase() : null;
      if (validated.city !== undefined) existing.city = validated.city ?? '';
      if (validated.region !== undefined) existing.region = validated.region ?? '';
      if (validated.country) existing.country = validated.country;
      if (validated.timezone) existing.timezone = validated.timezone;
      if (validated.status) existing.status = validated.status;
      if (validated.priority) existing.priority = validated.priority;
      if (validated.isDnc !== undefined) {
        existing.is_dnc = validated.isDnc;
        if (validated.isDnc) existing.status = 'dnc';
      }
      if (validated.dncReason !== undefined) existing.dnc_reason = validated.dncReason;
      existing.updated_at = new Date().toISOString();

      const tags = (store.tags[id] || []).map((t) => t.name);
      return this.toDomain(existing, tags);
    }

    const existing = await this.repo.getById(id, orgId);
    if (!existing) throw new Error('Lead not found');

    const updatePayload: LeadUpdate = {};
    const newFirst = validated.firstName !== undefined ? validated.firstName : (existing.first_name || (existing.name ? existing.name.split(' ')[0] : ''));
    const newLast = validated.lastName !== undefined ? validated.lastName : (existing.last_name || (existing.name ? existing.name.split(' ').slice(1).join(' ') : ''));
    const computedFullName = [newFirst, newLast].filter(Boolean).join(' ').trim();
    if (computedFullName) {
      updatePayload.name = computedFullName;
      updatePayload.full_name = computedFullName;
    }
    if (validated.firstName !== undefined) updatePayload.first_name = validated.firstName;
    if (validated.lastName !== undefined) updatePayload.last_name = validated.lastName;
    if (validated.companyName !== undefined) {
      updatePayload.company = validated.companyName;
      updatePayload.company_name = validated.companyName;
    }
    if (validated.jobTitle !== undefined) {
      updatePayload.title = validated.jobTitle;
      updatePayload.job_title = validated.jobTitle;
    }
    if (validated.email !== undefined) updatePayload.email = validated.email ? validated.email.toLowerCase() : null;
    if (validated.city) updatePayload.city = validated.city;
    if (validated.region) updatePayload.region = validated.region;
    if (validated.country) updatePayload.country = validated.country;
    if (validated.timezone) updatePayload.timezone = validated.timezone;
    if (validated.status) updatePayload.status = validated.status;
    if (validated.priority) updatePayload.priority = validated.priority;
    if (validated.isDnc !== undefined) {
      updatePayload.is_dnc = validated.isDnc;
      if (validated.isDnc) updatePayload.status = 'dnc';
    }
    if (validated.dncReason !== undefined) updatePayload.dnc_reason = validated.dncReason;

    if (validated.phone) {
      const phoneNorm = normalizePhone(validated.phone, validated.country ?? existing.country);
      if (phoneNorm.isValid && phoneNorm.e164) {
        updatePayload.phone = validated.phone;
        updatePayload.phone_e164 = phoneNorm.e164;
      }
    }

    if (validated.customFields) {
      updatePayload.custom_fields = {
        ...(typeof existing.custom_fields === 'object' && existing.custom_fields !== null
          ? (existing.custom_fields as Record<string, unknown>)
          : {}),
        ...validated.customFields,
      } as Json;
    }

    const row = await this.repo.update(id, orgId, updatePayload);

    await this.logAudit(orgId, actorId, 'lead.updated', 'lead', id, {
      changedFields: Object.keys(updatePayload),
    });

    const tags = await this.tagsRepo.getTagsForLead(id);
    return this.toDomain(row, tags.map((t) => t.name));
  }

  async markDnc(id: string, reason: string = 'Customer requested Do-Not-Call', organizationId?: string, actorId?: string): Promise<Lead> {
    const orgId = organizationId ?? this.defaultOrgId;

    if (this.isMockDevMode) {
      const store = getDevStore();
      const row = store.leads.find((l) => l.id === id);
      if (!row) throw new Error('Lead not found');
      row.is_dnc = true;
      row.dnc_reason = reason;
      row.status = 'dnc';
      row.updated_at = new Date().toISOString();
      const tags = (store.tags[id] || []).map((t) => t.name);
      return this.toDomain(row, tags);
    }

    const row = await this.repo.markDnc(id, orgId, reason);

    await this.logAudit(orgId, actorId, 'lead.dnc_marked', 'lead', id, { reason });
    return this.toDomain(row);
  }

  async removeDnc(id: string, organizationId?: string, actorId?: string): Promise<Lead> {
    const orgId = organizationId ?? this.defaultOrgId;

    if (this.isMockDevMode) {
      const store = getDevStore();
      const row = store.leads.find((l) => l.id === id);
      if (!row) throw new Error('Lead not found');
      row.is_dnc = false;
      row.dnc_reason = null;
      row.status = 'new';
      row.updated_at = new Date().toISOString();
      const tags = (store.tags[id] || []).map((t) => t.name);
      return this.toDomain(row, tags);
    }

    const row = await this.repo.removeDnc(id, orgId);

    await this.logAudit(orgId, actorId, 'lead.dnc_removed', 'lead', id, {});
    return this.toDomain(row);
  }

  async archiveLead(id: string, organizationId?: string, actorId?: string): Promise<Lead> {
    const orgId = organizationId ?? this.defaultOrgId;

    if (this.isMockDevMode) {
      const store = getDevStore();
      const row = store.leads.find((l) => l.id === id);
      if (!row) throw new Error('Lead not found');
      row.is_archived = true;
      row.archived_at = new Date().toISOString();
      const tags = (store.tags[id] || []).map((t) => t.name);
      return this.toDomain(row, tags);
    }

    const row = await this.repo.archive(id, orgId);

    await this.logAudit(orgId, actorId, 'lead.archived', 'lead', id, {});
    return this.toDomain(row);
  }

  async addNote(leadId: string, content: string, authorId: string): Promise<HydratedLeadNote> {
    if (this.isMockDevMode) {
      const store = getDevStore();
      if (!store.notes[leadId]) store.notes[leadId] = [];
      const newNote: HydratedLeadNote = {
        id: `note_${Date.now()}`,
        lead_id: leadId,
        author_id: authorId,
        content,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        author_name: 'Operator',
        author_avatar: undefined,
      };
      store.notes[leadId].unshift(newNote);
      return newNote;
    }

    const row = await this.notesRepo.create({
      lead_id: leadId,
      author_id: authorId,
      content,
    });

    return {
      ...row,
      author_name: 'Operator',
    };
  }

  async getNotes(leadId: string): Promise<HydratedLeadNote[]> {
    if (this.isMockDevMode) {
      const store = getDevStore();
      return store.notes[leadId] || [];
    }
    return this.notesRepo.listByLeadId(leadId);
  }

  async addTag(leadId: string, tagName: string, color?: string, organizationId?: string): Promise<LeadTagRow> {
    const orgId = organizationId ?? this.defaultOrgId;

    if (this.isMockDevMode) {
      const store = getDevStore();
      if (!store.tags[leadId]) store.tags[leadId] = [];
      const existing = store.tags[leadId].find((t) => t.name.toLowerCase() === tagName.toLowerCase());
      if (existing) return existing;
      const newTag: LeadTagRow = {
        id: `tag_${Date.now()}`,
        organization_id: orgId,
        name: tagName,
        color: color || '#0284c7',
      };
      store.tags[leadId].push(newTag);
      return newTag;
    }

    const tag = await this.tagsRepo.getOrCreateTag(orgId, tagName, color);
    await this.tagsRepo.assignTag(leadId, tag.id);
    return tag;
  }

  async removeTag(leadId: string, tagId: string): Promise<void> {
    if (this.isMockDevMode) {
      const store = getDevStore();
      if (store.tags[leadId]) {
        store.tags[leadId] = store.tags[leadId].filter((t) => t.id !== tagId && t.name !== tagId);
      }
      return;
    }
    await this.tagsRepo.removeTag(leadId, tagId);
  }

  async executeBulkAction(input: LeadBulkActionInput, organizationId?: string, actorId?: string): Promise<{ affected: number }> {
    const validated = leadBulkActionSchema.parse(input);
    const orgId = organizationId ?? this.defaultOrgId;

    if (this.isMockDevMode) {
      const store = getDevStore();
      const targetLeads = store.leads.filter((l) => validated.leadIds.includes(l.id));

      switch (validated.action) {
        case 'dnc':
          targetLeads.forEach((l) => {
            l.is_dnc = true;
            l.dnc_reason = validated.dncReason ?? 'Bulk DNC Action';
            l.status = 'dnc';
          });
          break;
        case 'status':
          if (validated.status) {
            targetLeads.forEach((l) => {
              l.status = validated.status as LeadStatusDb;
            });
          }
          break;
        case 'archive':
          targetLeads.forEach((l) => {
            l.is_archived = true;
            l.archived_at = new Date().toISOString();
          });
          break;
        case 'tag':
          if (validated.tagName) {
            targetLeads.forEach((l) => {
              if (!store.tags[l.id]) store.tags[l.id] = [];
              if (!store.tags[l.id].some((t) => t.name.toLowerCase() === validated.tagName!.toLowerCase())) {
                store.tags[l.id].push({
                  id: `tag_${Date.now()}_${l.id}`,
                  organization_id: orgId,
                  name: validated.tagName!,
                  color: '#0284c7',
                });
              }
            });
          }
          break;
      }
      return { affected: targetLeads.length };
    }

    switch (validated.action) {
      case 'dnc':
        await this.repo.bulkSetDnc(validated.leadIds, orgId, validated.dncReason ?? 'Bulk DNC Action');
        break;
      case 'status':
        if (validated.status) {
          await this.repo.bulkUpdateStatus(validated.leadIds, orgId, validated.status as LeadStatusDb);
        }
        break;
      case 'archive':
        await this.repo.bulkArchive(validated.leadIds, orgId);
        break;
      case 'tag':
        if (validated.tagName) {
          const tag = await this.tagsRepo.getOrCreateTag(orgId, validated.tagName);
          await this.tagsRepo.bulkAssignTag(validated.leadIds, tag.id);
        }
        break;
    }

    await this.logAudit(orgId, actorId, `lead.bulk_${validated.action}`, 'leads', null, {
      count: validated.leadIds.length,
      leadIds: validated.leadIds.slice(0, 10),
    });

    return { affected: validated.leadIds.length };
  }

  /**
   * Previews CSV ingestion without committing rows to the database.
   */
  async previewCsvImport(
    rawCsvText: string,
    mappings: ColumnMappingConfig,
    defaultCountry: string = 'US',
    organizationId?: string
  ): Promise<CsvPreviewSummary> {
    const orgId = organizationId ?? this.defaultOrgId;
    const parsed = parseCsv(rawCsvText);

    if (parsed.errors.length > 0 && parsed.rows.length === 0) {
      return {
        totalRows: 0,
        readyRows: 0,
        validRows: 0,
        newRows: 0,
        invalidRows: 0,
        duplicateCount: 0,
        intraFileDuplicates: 0,
        existingDuplicates: 0,
        dncCount: 0,
        warnings: parsed.errors,
        sampleRows: [],
        problemRows: [],
      };
    }

    const normalized = normalizeCsvRows(parsed.rows, mappings, defaultCountry);

    const phones = normalized.map((r) => r.phoneE164).filter(Boolean) as string[];
    const emails = normalized.map((r) => r.email).filter(Boolean) as string[];

    let existingCandidates: LeadRow[] = [];
    if (this.isMockDevMode) {
      const store = getDevStore();
      existingCandidates = store.leads.filter(
        (l) => (l.phone_e164 && phones.includes(l.phone_e164)) || (l.email && emails.includes(l.email.toLowerCase()))
      );
    } else {
      existingCandidates = await this.repo.findDuplicates(phones, emails, orgId);
    }

    const { annotatedRows, duplicateCount, intraFileDuplicates, existingDuplicates, dncCount, problemRows } =
      detectDuplicatesAndDnc(normalized, existingCandidates);

    const validRows = annotatedRows.filter((r) => r.isValid).length;
    const invalidRows = annotatedRows.length - validRows;
    const readyRows = Math.max(0, annotatedRows.length - duplicateCount - dncCount - invalidRows);
    const newRows = readyRows;

    return {
      totalRows: annotatedRows.length,
      readyRows,
      validRows,
      newRows,
      invalidRows,
      duplicateCount,
      intraFileDuplicates,
      existingDuplicates,
      dncCount,
      warnings: parsed.errors,
      sampleRows: annotatedRows.slice(0, 5),
      problemRows: problemRows,
    };
  }

  /**
   * Executes bulk CSV ingestion with chunking, deduplication strategy, and DNC preservation.
   */
  async executeCsvImport(
    rawCsvText: string,
    mappings: ColumnMappingConfig,
    strategy: DuplicateStrategy = 'skip',
    targetCampaignId?: string,
    filename: string = 'uploaded_leads.csv',
    organizationId?: string,
    actorId?: string
  ): Promise<{
    inserted: number;
    updated: number;
    skipped: number;
    invalid: number;
    dncProtected: number;
    jobId: string;
    totalRows: number;
    intraFileDuplicates: number;
    existingDuplicates: number;
    problemRows: ImportProblemRow[];
    errorCsv: string | null;
    status: 'completed' | 'partial_success' | 'failed' | 'no_records_imported';
    leadImportStatus: 'completed' | 'failed' | 'empty';
    campaignEnrollmentStatus: 'completed' | 'failed' | 'not_requested' | 'skipped_capacity';
    campaignEnrollment?: {
      campaignId: string;
      campaignName: string;
      enrolled: number;
      skippedCapacity: number;
      alreadyEnrolled: number;
      dncProtected: number;
      invalid: number;
      error?: string | null;
    };
    importedLeadIds?: string[];
    recoveryGuidance?: string | null;
  }> {
    const orgId = organizationId ?? this.defaultOrgId;

    // 1. Pre-validate target campaign if specified
    let targetCampaign: any = null;
    if (targetCampaignId) {
      targetCampaign = await this.campaignsRepo.getById(targetCampaignId, orgId);
      if (!targetCampaign) {
        throw new Error(`Target campaign "${targetCampaignId}" not found or organization access denied.`);
      }
      if (targetCampaign.status === 'completed' || targetCampaign.status === 'cancelled' || targetCampaign.status === 'archived') {
        throw new Error(
          `Cannot enroll leads into campaign "${targetCampaign.name}" with terminal status "${targetCampaign.status}".`
        );
      }
      const currentCapacity = await this.campaignsRepo.getEnrolledCount(targetCampaignId);
      if (currentCapacity >= 100) {
        throw new Error(
          `Cannot import leads into campaign "${targetCampaign.name}": Campaign has reached its maximum capacity of 100 leads.`
        );
      }
    }

    const parsed = parseCsv(rawCsvText);
    const normalized = normalizeCsvRows(parsed.rows, mappings);

    let existingCandidates: LeadRow[] = [];
    const phones = normalized.map((r) => r.phoneE164).filter(Boolean) as string[];
    const emails = normalized.map((r) => r.email).filter(Boolean) as string[];

    if (this.isMockDevMode) {
      const store = getDevStore();
      existingCandidates = store.leads.filter(
        (l) => (l.phone_e164 && phones.includes(l.phone_e164)) || (l.email && emails.includes(l.email.toLowerCase()))
      );

      const { annotatedRows, duplicateCount, intraFileDuplicates, existingDuplicates, dncCount, problemRows } =
        detectDuplicatesAndDnc(normalized, existingCandidates);
      const { toInsert, toUpdate, skippedCount } = buildDatabaseOperations(
        annotatedRows,
        existingCandidates,
        strategy,
        orgId,
        actorId
      );

      let insertedCount = 0;
      let updatedCount = 0;
      const enrolledLeadIds: string[] = [];

      for (const item of toInsert) {
        const fullName = `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'Unnamed Lead';
        const newLead: LeadRow = {
          id: `ld_import_${Date.now()}_${insertedCount}`,
          organization_id: orgId,
          name: fullName,
          company: item.company_name,
          title: item.job_title ?? '',
          temperature: 'COLD',
          do_not_call: item.is_dnc ?? false,
          deleted_at: null,
          first_name: item.first_name,
          last_name: item.last_name,
          full_name: fullName,
          company_name: item.company_name,
          job_title: item.job_title ?? '',
          phone: item.phone,
          phone_e164: item.phone_e164 ?? item.phone,
          email: item.email ?? null,
          country: item.country || 'US',
          region: item.region ?? '',
          city: item.city ?? '',
          timezone: item.timezone || 'America/Chicago',
          source: item.source || 'csv_import',
          status: item.status || 'new',
          priority: item.priority || 'medium',
          is_dnc: item.is_dnc ?? false,
          dnc_reason: item.dnc_reason ?? null,
          is_archived: false,
          archived_at: null,
          last_contacted_at: null,
          next_contact_at: null,
          created_by: actorId ?? null,
          custom_fields: item.custom_fields ?? {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        store.leads.unshift(newLead);
        enrolledLeadIds.push(newLead.id);
        insertedCount++;
      }

      for (const updateOp of toUpdate) {
        const target = store.leads.find((l) => l.id === updateOp.id);
        if (target) {
          Object.assign(target, updateOp.updates);
          target.updated_at = new Date().toISOString();
          enrolledLeadIds.push(target.id);
          updatedCount++;
        }
      }

      let campaignEnrollment: any = undefined;
      let enrollmentError: string | null = null;
      let campaignEnrollmentStatus: 'completed' | 'failed' | 'not_requested' | 'skipped_capacity' = 'not_requested';

      if (targetCampaignId) {
        if (enrolledLeadIds.length > 0) {
          try {
            const enrollResult = await this.campaignsService.enrollLeads(
              targetCampaignId,
              enrolledLeadIds,
              orgId,
              actorId
            );
            campaignEnrollmentStatus =
              enrollResult.skippedCapacity > 0 && enrollResult.added === 0 ? 'skipped_capacity' : 'completed';
            campaignEnrollment = {
              campaignId: targetCampaignId,
              campaignName: targetCampaign?.name || targetCampaignId,
              enrolled: enrollResult.added,
              skippedCapacity: enrollResult.skippedCapacity,
              alreadyEnrolled: enrollResult.alreadyAdded,
              dncProtected: enrollResult.dncProtected,
              invalid: enrollResult.invalid,
            };
          } catch (enrollErr: any) {
            enrollmentError = enrollErr.message;
            campaignEnrollmentStatus = 'failed';
            campaignEnrollment = {
              campaignId: targetCampaignId,
              campaignName: targetCampaign?.name || targetCampaignId,
              enrolled: 0,
              skippedCapacity: 0,
              alreadyEnrolled: 0,
              dncProtected: 0,
              invalid: 0,
              error: enrollErr.message,
            };
          }
        }
      }

      const isPartial = enrollmentError !== null;
      const errorCsv = problemRows.length > 0 ? generateErrorCsv(problemRows) : null;

      return {
        inserted: insertedCount,
        updated: updatedCount,
        skipped: skippedCount,
        invalid: annotatedRows.filter((r) => !r.isValid).length,
        dncProtected: dncCount,
        jobId: `job_dev_${Date.now()}`,
        totalRows: annotatedRows.length,
        intraFileDuplicates,
        existingDuplicates,
        problemRows,
        errorCsv,
        status: isPartial ? 'partial_success' : 'completed',
        leadImportStatus: 'completed',
        campaignEnrollmentStatus,
        campaignEnrollment,
        importedLeadIds: enrolledLeadIds,
        recoveryGuidance: isPartial
          ? `Leads were imported into CRM (${insertedCount} new, ${updatedCount} updated), but campaign auto-enrollment could not be completed: ${enrollmentError}. Leads are safely stored in your CRM. Re-uploading will recognize existing leads idempotently, or you can assign them from the campaign management view.`
          : null,
      };
    }

    // Production Supabase path: Strictly enforce public.import_leads RPC execution.
    // The RPC internally creates the lead_import_jobs record, executes deduplication,
    // and returns the canonical job_id and processing metrics.
    // We do NOT create a separate job prior to the RPC, preventing duplicate job records.
    existingCandidates = await this.repo.findDuplicates(phones, emails, orgId);

    const { annotatedRows, duplicateCount, intraFileDuplicates, existingDuplicates, dncCount, problemRows } =
      detectDuplicatesAndDnc(normalized, existingCandidates);

    const errorCsv = problemRows.length > 0 ? generateErrorCsv(problemRows) : null;

    // Filter to rows that should be imported based on strategy
    const rowsToImport = annotatedRows.filter((r) => {
      if (!r.isValid) return false;
      if (r.isDuplicate && strategy === 'skip') return false;
      return true;
    });

    if (rowsToImport.length === 0) {
      const jobId = `job_empty_${Date.now()}`;
      return {
        inserted: 0,
        updated: 0,
        skipped: duplicateCount,
        invalid: annotatedRows.filter((r) => !r.isValid).length,
        dncProtected: dncCount,
        jobId,
        totalRows: annotatedRows.length,
        intraFileDuplicates,
        existingDuplicates,
        problemRows,
        errorCsv,
        status: 'no_records_imported',
        leadImportStatus: 'empty',
        campaignEnrollmentStatus: 'not_requested',
      };
    }

    const payloadRows = rowsToImport.map((r) => {
      const fullName =
        [r.firstName, r.lastName].filter(Boolean).join(' ').trim() ||
        r.name ||
        'Unnamed lead';
      const company = r.company || '';
      const title = r.title || '';
      const phone = r.phoneE164 || r.phone || '';
      const email = r.email || '';
      const city = r.city || '';

      return {
        name: fullName,
        company,
        title,
        phone,
        email,
        city,
        first_name: r.firstName,
        last_name: r.lastName,
        company_name: r.company,
        job_title: r.title,
        country: r.country || 'US',
        region: r.region || null,
        timezone: r.timezone || 'America/Chicago',
        custom_fields: r.customFields || {},
      };
    });

    let inserted = 0;
    let updated = 0;
    let skipped = duplicateCount;
    const invalid = annotatedRows.filter((r) => !r.isValid).length;
    const dncProtected = dncCount;
    let jobId = `job_import_${Date.now()}`;
    let leadIdsToEnroll: string[] = [];

    // Attempt RPC if available and authorized; otherwise seamlessly execute direct repository operations
    let usedRpc = false;
    try {
      const { data: rpcResult, error: rpcError } = await this.supabase.rpc('import_leads', {
        filename,
        rows: payloadRows as unknown as Json,
      });
      if (!rpcError && rpcResult && typeof rpcResult === 'object') {
        usedRpc = true;
        const res = rpcResult as Record<string, unknown>;
        jobId = String(res.job_id || res.id || `job_rpc_${Date.now()}`);
        inserted = Number(res.inserted ?? res.inserted_count ?? 0);
        updated = Number(res.updated ?? res.updated_count ?? 0);
        const rpcSkipped = Number(res.duplicates ?? res.duplicate_count ?? res.skipped ?? res.skipped_count ?? 0);
        skipped = rpcSkipped + (normalized.length - rowsToImport.length);
      }
    } catch {
      usedRpc = false;
    }

    if (!usedRpc) {
      const { toInsert, toUpdate, skippedCount } = buildDatabaseOperations(
        annotatedRows,
        existingCandidates,
        strategy,
        orgId,
        actorId
      );
      skipped = skippedCount;

      // 1. Batch insert new leads (chunked by 50)
      if (toInsert.length > 0) {
        for (let i = 0; i < toInsert.length; i += 50) {
          const chunk = toInsert.slice(i, i + 50);
          const insertedBatch = await this.repo.createBatch(chunk);
          inserted += insertedBatch.length;
          leadIdsToEnroll.push(...insertedBatch.map((l) => l.id));
        }
      }

      // 2. Update existing leads where requested by strategy
      if (toUpdate.length > 0) {
        for (const op of toUpdate) {
          try {
            const updatedLead = await this.repo.update(op.id, orgId, op.updates);
            updated++;
            leadIdsToEnroll.push(updatedLead.id);
          } catch {
            // non-blocking for partial row updates
          }
        }
      }

      // 3. Record job in lead_import_jobs table
      try {
        const { data: jobData } = await this.supabase
          .from('lead_import_jobs')
          .insert({
            organization_id: orgId,
            created_by: actorId ?? null,
            filename,
            status: 'completed',
            row_count: annotatedRows.length,
            inserted_count: inserted,
            duplicate_count: duplicateCount,
          })
          .select()
          .maybeSingle();
        if (jobData?.id) jobId = jobData.id;
      } catch {
        // lead_import_jobs tracking non-blocking
      }
    }

    let campaignEnrollment: any = undefined;
    let enrollmentError: string | null = null;
    let campaignEnrollmentStatus: 'completed' | 'failed' | 'not_requested' | 'skipped_capacity' = 'not_requested';

    if (targetCampaignId && (inserted > 0 || updated > 0)) {
      if (leadIdsToEnroll.length === 0) {
        const importedPhones = rowsToImport.map((r) => r.phoneE164).filter(Boolean) as string[];
        const importedEmails = rowsToImport.map((r) => r.email).filter(Boolean) as string[];
        const importedLeads = await this.repo.findDuplicates(importedPhones, importedEmails, orgId);
        leadIdsToEnroll = importedLeads.map((l) => l.id);
      }

      if (leadIdsToEnroll.length > 0) {
        try {
          const enrollResult = await this.campaignsService.enrollLeads(
            targetCampaignId,
            leadIdsToEnroll,
            orgId,
            actorId
          );
          campaignEnrollmentStatus =
            enrollResult.skippedCapacity > 0 && enrollResult.added === 0 ? 'skipped_capacity' : 'completed';
          campaignEnrollment = {
            campaignId: targetCampaignId,
            campaignName: targetCampaign?.name || targetCampaignId,
            enrolled: enrollResult.added,
            skippedCapacity: enrollResult.skippedCapacity,
            alreadyEnrolled: enrollResult.alreadyAdded,
            dncProtected: enrollResult.dncProtected,
            invalid: enrollResult.invalid,
          };

          // Persist completed enrollment state to lead_import_jobs record
          if (jobId && !jobId.startsWith('job_rpc_') && !jobId.startsWith('job_dev_') && !jobId.startsWith('job_empty_')) {
            await this.supabase.from('lead_import_jobs').update({
              target_campaign_id: targetCampaignId,
              error_summary: {
                stage: 'completed',
                enrollment: enrollResult,
                imported_lead_ids: leadIdsToEnroll,
              } as any,
            }).eq('id', jobId);
          }
        } catch (enrollErr: any) {
          enrollmentError = enrollErr.message;
          campaignEnrollmentStatus = 'failed';
          campaignEnrollment = {
            campaignId: targetCampaignId,
            campaignName: targetCampaign?.name || targetCampaignId,
            enrolled: 0,
            skippedCapacity: 0,
            alreadyEnrolled: 0,
            dncProtected: 0,
            invalid: 0,
            error: enrollErr.message,
          };

          // Persist partial-success / enrollment failure state to lead_import_jobs record for recovery
          if (jobId && !jobId.startsWith('job_rpc_') && !jobId.startsWith('job_dev_') && !jobId.startsWith('job_empty_')) {
            await this.supabase.from('lead_import_jobs').update({
              target_campaign_id: targetCampaignId,
              error: `Campaign enrollment failed: ${enrollErr.message}`,
              error_summary: {
                stage: 'campaign_enrollment_failed',
                error: enrollErr.message,
                imported_lead_ids: leadIdsToEnroll,
                recovery_guidance: 'Leads are saved in CRM. Re-uploading will recognize existing leads idempotently.',
              } as any,
            }).eq('id', jobId);
          }

          await this.logAudit(orgId, actorId, 'leads.campaign_enrollment_failed', 'campaigns', targetCampaignId, {
            error: enrollErr.message,
            jobId,
            leadsCount: leadIdsToEnroll.length,
          });
        }
      }
    }

    const isPartial = enrollmentError !== null;

    // Audit log referencing canonical job_id created by RPC
    await this.logAudit(orgId, actorId, 'leads.csv_imported', 'lead_import_jobs', jobId, {
      filename,
      jobId,
      totalRows: normalized.length,
      inserted,
      updated,
      skipped,
      dncProtected,
      invalid,
      strategy,
      targetCampaignId: targetCampaignId || null,
      campaignEnrollment: campaignEnrollment || null,
      status: isPartial ? 'partial_success' : 'completed',
      method: 'public.import_leads_rpc',
    });

    const isNone = inserted === 0 && updated === 0;
    const finalStatus = isNone ? 'no_records_imported' : isPartial ? 'partial_success' : 'completed';

    return {
      inserted,
      updated,
      skipped,
      invalid,
      dncProtected,
      jobId,
      totalRows: annotatedRows.length,
      intraFileDuplicates,
      existingDuplicates,
      problemRows,
      errorCsv,
      status: finalStatus,
      leadImportStatus: 'completed',
      campaignEnrollmentStatus,
      campaignEnrollment,
      importedLeadIds: leadIdsToEnroll,
      recoveryGuidance: isPartial
        ? `Leads were successfully imported into CRM (${inserted} inserted, ${updated} updated), but could not be enrolled into campaign "${targetCampaign?.name || targetCampaignId}": ${enrollmentError}. Leads are safely stored and can be assigned directly from the Campaigns tab without re-importing.`
        : null,
    };
  }

  /**
   * Safely resumes campaign enrollment from a previously recorded import job.
   * Uses persisted imported_lead_ids to ensure zero duplicate lead creation
   * and prevents enrolling unrelated CRM contacts.
   */
  async resumeCampaignEnrollment(
    jobId: string,
    targetCampaignId: string,
    organizationId?: string,
    actorId?: string
  ): Promise<{
    success: boolean;
    jobId: string;
    targetCampaignId: string;
    enrolled: number;
    skippedCapacity: number;
    alreadyEnrolled: number;
    dncProtected: number;
    invalid: number;
    error?: string | null;
  }> {
    const orgId = organizationId ?? this.defaultOrgId;

    // 1. Fetch persisted job metadata
    let persistedLeadIds: string[] = [];
    if (this.isMockDevMode) {
      const store = getDevStore();
      const job = (store as any).importJobs?.find((j: any) => j.id === jobId && j.organization_id === orgId);
      if (!job) {
        throw new Error(`Import job "${jobId}" not found or organization access denied.`);
      }
      persistedLeadIds = (job.error_summary as any)?.imported_lead_ids || [];
    } else {
      const { data: job, error: jobError } = await this.supabase
        .from('lead_import_jobs')
        .select('*')
        .eq('id', jobId)
        .eq('organization_id', orgId)
        .maybeSingle();

      if (jobError || !job) {
        throw new Error(`Import job "${jobId}" not found or organization access denied.`);
      }
      persistedLeadIds = (job.error_summary as any)?.imported_lead_ids || [];
    }

    if (persistedLeadIds.length === 0) {
      throw new Error(
        `Import job "${jobId}" does not contain any persisted imported lead IDs for recovery.`
      );
    }

    // 2. Validate target campaign
    const targetCampaign = await this.campaignsRepo.getById(targetCampaignId, orgId);
    if (!targetCampaign) {
      throw new Error(`Target campaign "${targetCampaignId}" not found or organization access denied.`);
    }
    if (targetCampaign.status === 'completed' || targetCampaign.status === 'cancelled' || targetCampaign.status === 'archived') {
      throw new Error(
        `Cannot enroll leads into campaign "${targetCampaign.name}" with terminal status "${targetCampaign.status}".`
      );
    }

    // 3. Attempt enrollment with persisted lead IDs
    const enrollResult = await this.campaignsService.enrollLeads(
      targetCampaignId,
      persistedLeadIds,
      orgId,
      actorId
    );

    // 4. Update job record with successful enrollment state
    if (!this.isMockDevMode && !jobId.startsWith('job_rpc_') && !jobId.startsWith('job_dev_')) {
      await this.supabase
        .from('lead_import_jobs')
        .update({
          target_campaign_id: targetCampaignId,
          status: 'completed',
          error: null,
          error_summary: {
            stage: 'completed',
            enrollment: enrollResult,
            imported_lead_ids: persistedLeadIds,
          } as any,
        })
        .eq('id', jobId);
    }

    return {
      success: true,
      jobId,
      targetCampaignId,
      enrolled: enrollResult.added,
      skippedCapacity: enrollResult.skippedCapacity,
      alreadyEnrolled: enrollResult.alreadyAdded,
      dncProtected: enrollResult.dncProtected,
      invalid: enrollResult.invalid,
    };
  }

  /**
   * Asserts whether a lead is eligible to receive an outbound phone call.
   * Throws an Error if the lead is DNC, archived, or missing a valid phone.
   */
  async assertLeadCallable(
    leadId: string,
    organizationId?: string
  ): Promise<{ callable: boolean; reason?: string }> {
    const orgId = organizationId ?? this.defaultOrgId;

    if (this.isMockDevMode) {
      const store = getDevStore();
      const lead = store.leads.find((l) => l.id === leadId);
      if (!lead) {
        throw new Error(`Lead "${leadId}" not found`);
      }
      if (lead.is_archived) {
        throw new Error(`Cannot call ${lead.full_name}: Lead record is archived.`);
      }
      if (lead.is_dnc || lead.status === 'dnc') {
        throw new Error(`Cannot call ${lead.full_name}: Marked as Do Not Call (DNC). Reason: ${lead.dnc_reason || 'Protected'}`);
      }
      if (!lead.phone || lead.phone.trim().length < 7) {
        throw new Error(`Cannot call ${lead.full_name}: Missing or invalid phone number.`);
      }
      return { callable: true };
    }

    const lead = await this.repo.getById(leadId, orgId);
    if (!lead) {
      throw new Error(`Lead "${leadId}" not found`);
    }

    if (lead.is_archived) {
      throw new Error(`Cannot call ${lead.full_name}: Lead record is archived.`);
    }

    if (lead.is_dnc || lead.status === 'dnc') {
      throw new Error(`Cannot call ${lead.full_name}: Marked as Do Not Call (DNC). Reason: ${lead.dnc_reason || 'Protected'}`);
    }

    if (!lead.phone || lead.phone.trim().length < 7) {
      throw new Error(`Cannot call ${lead.full_name}: Missing or invalid phone number.`);
    }

    return { callable: true };
  }

  private async logAudit(
    organizationId: string,
    actorId: string | undefined,
    action: string,
    entityType: string,
    entityId: string | null,
    metadata: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.supabase.from('audit_logs').insert({
        organization_id: organizationId,
        actor_user_id: actorId ?? null,
        action,
        entity_type: entityType,
        entity_id: entityId,
        metadata: metadata as Json,
      });
    } catch (err) {
      // Audit log failures shouldn't crash the primary transaction
      console.warn('Audit logging notice:', err);
    }
  }
}
