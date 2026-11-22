'use client';

import React, { useState } from 'react';
import { Icon } from '@/lib/ui/icons';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'operator' | 'viewer';
  status: 'active' | 'invited';
  lastActive: string;
}

const initialTeam: TeamMember[] = [
  {
    id: 'usr_sarah',
    name: 'Sarah Connor',
    email: 'sarah.connor@rm-materials.com',
    role: 'operator',
    status: 'active',
    lastActive: 'Just now',
  },
  {
    id: 'usr_admin',
    name: 'Alexander Wright',
    email: 'a.wright@rm-materials.com',
    role: 'admin',
    status: 'active',
    lastActive: '5 mins ago',
  },
  {
    id: 'usr_elena',
    name: 'Elena Rostova',
    email: 'elena.r@rm-materials.com',
    role: 'manager',
    status: 'active',
    lastActive: '1 hour ago',
  },
  {
    id: 'usr_marcus',
    name: 'Marcus Vance',
    email: 'm.vance@rm-materials.com',
    role: 'viewer',
    status: 'invited',
    lastActive: 'Pending invite',
  },
];

export function UsersRolesPanel() {
  const [team, setTeam] = useState<TeamMember[]>(initialTeam);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'manager' | 'operator' | 'viewer'>('operator');

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteName) return;

    const newMember: TeamMember = {
      id: `usr_${Date.now()}`,
      name: inviteName,
      email: inviteEmail,
      role: inviteRole,
      status: 'invited',
      lastActive: 'Pending invite',
    };

    setTeam((prev) => [newMember, ...prev]);
    setInviteName('');
    setInviteEmail('');
    setIsInviteOpen(false);
  };

  const handleRoleChange = (userId: string, newRole: 'admin' | 'manager' | 'operator' | 'viewer') => {
    setTeam((prev) =>
      prev.map((m) => (m.id === userId ? { ...m, role: newRole } : m))
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Team Members List */}
      <div className="bg-surface p-6 rounded-xl border border-border shadow-sm flex flex-col gap-5">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Icon name="group" size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-on-surface">Team Members &amp; Access Controls</h2>
              <p className="text-xs text-on-surface-variant">
                Manage organization operators, managers, and administrative privileges.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsInviteOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary-hover transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Icon name="person_add" size={16} />
            <span>Invite User</span>
          </button>
        </div>

        {/* Members Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-elevated text-xs font-mono uppercase text-on-surface-variant border-b border-border">
              <tr>
                <th className="py-2.5 px-3">Member</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Last Active</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {team.map((member) => (
                <tr key={member.id} className="hover:bg-surface-elevated/50 transition-colors">
                  <td className="py-3 px-3">
                    <div className="flex flex-col">
                      <span className="font-bold text-on-surface text-sm">{member.name}</span>
                      <span className="text-on-surface-variant font-mono text-xs">{member.email}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.id, e.target.value as any)}
                      className="px-2.5 py-1 rounded bg-surface-elevated border border-border text-xs font-semibold text-on-surface focus:outline-none focus:border-primary"
                    >
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                      <option value="operator">Operator (SDR)</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                        member.status === 'active'
                          ? 'bg-success/15 text-success border-success/30'
                          : 'bg-warning/15 text-warning border-warning/30'
                      }`}
                    >
                      {member.status === 'active' ? 'Active' : 'Invited'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-on-surface-variant font-mono">{member.lastActive}</td>
                  <td className="py-3 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => setTeam((prev) => prev.filter((m) => m.id !== member.id))}
                      className="text-error hover:underline text-xs font-semibold"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Permission Matrix */}
      <div className="bg-surface p-6 rounded-xl border border-border shadow-sm flex flex-col gap-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Icon name="badge" size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-on-surface">Role-Based Access Control (RBAC) Matrix</h2>
              <p className="text-xs text-on-surface-variant">
                Standard enterprise privileges enforced across all views and API gateways.
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-elevated text-xs font-mono uppercase text-on-surface-variant border-b border-border">
              <tr>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Workstation Cockpit</th>
                <th className="py-2.5 px-3">Campaign Creation</th>
                <th className="py-2.5 px-3">AI Agent Publishing</th>
                <th className="py-2.5 px-3">Settings &amp; Secrets</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              <tr>
                <td className="py-3 px-3 font-bold text-on-surface font-mono">ADMIN</td>
                <td className="py-3 px-3 text-success font-semibold">Full Access</td>
                <td className="py-3 px-3 text-success font-semibold">Create &amp; Launch</td>
                <td className="py-3 px-3 text-success font-semibold">Edit &amp; Publish</td>
                <td className="py-3 px-3 text-success font-semibold">Full Access</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-bold text-on-surface font-mono">MANAGER</td>
                <td className="py-3 px-3 text-success font-semibold">Full Access</td>
                <td className="py-3 px-3 text-success font-semibold">Create &amp; Launch</td>
                <td className="py-3 px-3 text-success font-semibold">Edit &amp; Publish</td>
                <td className="py-3 px-3 text-error font-semibold">Restricted</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-bold text-on-surface font-mono">OPERATOR / SDR</td>
                <td className="py-3 px-3 text-success font-semibold">Active Cockpit &amp; Callbacks</td>
                <td className="py-3 px-3 text-on-surface-variant">Queue Only</td>
                <td className="py-3 px-3 text-error font-semibold">Blocked</td>
                <td className="py-3 px-3 text-error font-semibold">Blocked</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-bold text-on-surface font-mono">VIEWER</td>
                <td className="py-3 px-3 text-error font-semibold">Blocked</td>
                <td className="py-3 px-3 text-on-surface-variant">Read-only</td>
                <td className="py-3 px-3 text-on-surface-variant">Read-only</td>
                <td className="py-3 px-3 text-error font-semibold">Blocked</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Modal */}
      {isInviteOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-surface rounded-2xl border border-border p-6 max-w-md w-full shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-base font-bold text-on-surface">Invite Team Member</h3>
              <button
                type="button"
                onClick={() => setIsInviteOpen(false)}
                className="text-on-surface-variant hover:text-on-surface"
              >
                <Icon name="close" size={20} />
              </button>
            </div>

            <form onSubmit={handleInvite} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-on-surface">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jane Doe"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="px-3.5 py-2.5 rounded-lg bg-surface-elevated border border-border text-sm text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-on-surface">Work Email</label>
                <input
                  type="email"
                  required
                  placeholder="jane@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="px-3.5 py-2.5 rounded-lg bg-surface-elevated border border-border text-sm text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-on-surface">Assigned Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="px-3.5 py-2.5 rounded-lg bg-surface-elevated border border-border text-sm text-on-surface focus:outline-none focus:border-primary"
                >
                  <option value="operator">Operator (SDR) — Workstation &amp; Calling</option>
                  <option value="manager">Manager — Campaign &amp; Agent Configuration</option>
                  <option value="admin">Admin — Full Enterprise Access</option>
                  <option value="viewer">Viewer — Reporting Only</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsInviteOpen(false)}
                  className="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-on-surface hover:bg-surface-elevated"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary-hover"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
