import { describe, it, expect } from 'vitest';
import {
  buildTasksIcsCalendar,
  escapeIcsText,
  foldIcsLine,
  formatIcsUtcStamp,
} from '../../src/core/ical.js';
import { DEFAULT_TASK_STATUSES, createProject, createTask } from '../../src/core/model.js';

describe('ical', () => {
  const NOW = '2026-11-15T10:30:00.000Z';

  it('échappe les caractères spéciaux RFC 5545 et plie les lignes à 75 octets UTF-8', () => {
    expect(escapeIcsText('A;B,C\\D\nE\r\nF')).toBe('A\\;B\\,C\\\\D\\nE\\nF');

    const longAccented = `SUMMARY:${'é'.repeat(50)}`;
    const folded = foldIcsLine(longAccented);
    const lines = folded.split('\r\n');
    expect(lines.length).toBeGreaterThan(1);
    const encoder = new TextEncoder();
    for (const seg of lines) {
      expect(encoder.encode(seg).length).toBeLessThanOrEqual(75);
    }
    for (const seg of lines.slice(1)) {
      expect(seg.startsWith(' ')).toBe(true);
    }
    expect(lines.map((l, idx) => (idx === 0 ? l : l.slice(1))).join('')).toBe(longAccented);
  });

  it('formate un timestamp UTC valide et exclut les tâches sans échéance', () => {
    expect(formatIcsUtcStamp(NOW)).toBe('20261115T103000Z');

    const p1 = createProject({ id: 'p1', name: 'Produit, Alpha', now: NOW });
    const tDated = createTask({
      id: 't-1',
      projectId: 'p1',
      title: 'Livrer v1.0, phase 1; finale',
      status: 'in_progress',
      priority: 'high',
      dueDate: '2026-11-20',
      descriptionDoc: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Note technique' }] }],
      },
      checklist: [{ id: 'c1', text: 'Publier ZIP', done: true }],
      now: NOW,
    });
    const tDone = createTask({
      id: 't-2',
      projectId: 'p1',
      title: 'Clôture audit',
      status: 'done',
      priority: 'low',
      dueDate: '2026-11-18',
      now: NOW,
    });
    const tUndated = createTask({
      id: 't-3',
      projectId: 'p1',
      title: 'Backlog sans date',
      dueDate: null,
      now: NOW,
    });

    const { icsContent, exportedCount } = buildTasksIcsCalendar([tDated, tDone, tUndated], [p1], {
      calName: 'Locavern — Test',
      statuses: DEFAULT_TASK_STATUSES,
      now: NOW,
    });

    expect(exportedCount).toBe(2);
    expect(icsContent.endsWith('\r\n')).toBe(true);
    const unfolded = icsContent.replace(/\r\n /g, '');
    expect(unfolded).toContain('BEGIN:VCALENDAR');
    expect(unfolded).toContain('END:VCALENDAR');
    expect(unfolded).toContain('DTSTART;VALUE=DATE:20261120');
    expect(unfolded).toContain('DTEND;VALUE=DATE:20261121');
    expect(unfolded).toContain('SUMMARY:Livrer v1.0\\, phase 1\\; finale');
    expect(unfolded).toContain('CATEGORIES:Produit\\, Alpha');
    expect(unfolded).toContain('STATUS:CONFIRMED');
    expect(unfolded).toContain('STATUS:COMPLETED');
    expect(unfolded).toContain('PRIORITY:1');
    expect(unfolded).toContain('Sous-tâches :\\n[x] Publier ZIP');
    expect(unfolded).not.toContain('Backlog sans date');
  });

  it('exporte DTSTART/DTEND horaire si dueTime est défini, exclut les archives et respecte les rôles de statut', () => {
    const pActive = createProject({ id: 'p1', name: 'Actif', now: NOW });
    const pArchived = createProject({ id: 'p2', name: 'Archivé', archived: true, now: NOW });
    const statuses = [
      { id: 'nouveau', label: 'Nouveau', isInitial: true },
      { id: 'cloture', label: 'Clôturé', isTerminal: true },
    ];
    const tTimed = createTask({
      id: 't-timed',
      projectId: 'p1',
      title: 'Astreinte nuit',
      status: 'nouveau',
      dueDate: '2026-11-20',
      dueTime: '23:30',
      allowedStatuses: statuses.map((s) => s.id),
      now: NOW,
    });
    const tArchived = createTask({
      id: 't-arch',
      projectId: 'p1',
      title: 'Tâche archivée',
      dueDate: '2026-11-21',
      archived: true,
      archivedAt: NOW,
      now: NOW,
    });
    const tViaProj = createTask({
      id: 't-proj-arch',
      projectId: 'p2',
      title: 'Tâche sous projet archivé',
      dueDate: '2026-11-22',
      now: NOW,
    });
    const { icsContent, exportedCount } = buildTasksIcsCalendar(
      [tTimed, tArchived, tViaProj],
      [pActive, pArchived],
      { statuses, now: NOW },
    );
    expect(exportedCount).toBe(1);
    const unfolded = icsContent.replace(/\r\n /g, '');
    expect(unfolded).toContain('DTSTART:20261120T233000');
    expect(unfolded).toContain('DTEND:20261121T003000');
    expect(unfolded).toContain('STATUS:TENTATIVE');
    expect(unfolded).not.toContain('Tâche archivée');
    expect(unfolded).not.toContain('Tâche sous projet archivé');
  });

  it('retourne 0 événement lorsqu’aucune tâche n’a de date', () => {
    const tUndated = createTask({ id: 't1', projectId: 'p1', title: 'Sans date', now: NOW });
    const res = buildTasksIcsCalendar([tUndated], [], { now: NOW });
    expect(res.exportedCount).toBe(0);
    expect(res.icsContent).not.toContain('BEGIN:VEVENT');
  });
});
