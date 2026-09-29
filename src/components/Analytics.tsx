import React, { useState } from 'react';
import { Building2, Clock, Users } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { Task, User } from '../types';
import {
  allUnitsOf,
  isOverdue,
  userMemberships,
  unitsForRole,
  designationRank,
} from '../utils/helpers';
import { TaskListModal } from './CommonPickers';

interface PersonPerf {
  name: string;
  unit: string;
  post: string;
  postRank: number;
  assignedTasks: Task[];
  completedTasks: Task[];
  pendingTasks: Task[];
  assigned: number;
  completed: number;
  rate: number;
  pending: number;
}

export function Analytics({
  currentUser,
  tasks,
  users,
  units,
  onOpenTask,
}: {
  currentUser: User;
  tasks: Task[];
  users: User[];
  units: string[];
  onOpenTask: (id: string) => void;
}) {
  const [listView, setListView] = useState<{
    title: string;
    personName: string;
    field: 'assignedTasks' | 'completedTasks' | 'pendingTasks';
  } | null>(null);

  const visibleUnits =
    currentUser.role === 'admin' ? units : allUnitsOf(currentUser);
  const scoped = tasks.filter((t) =>
    (t.units || []).some((u) => visibleUnits.includes(u))
  );

  const perUnit = visibleUnits.map((u) => {
    const ut = scoped.filter((t) => (t.units || []).includes(u));
    const completed = ut.filter(
      (t) => t.status === 'COMPLETED' || t.status === 'ARCHIVED'
    ).length;
    const overdue = ut.filter(isOverdue).length;
    return {
      unit: u
        .replace('Sub-Division ', 'SD ')
        .replace('PB - Head Office Technical Team', 'PB-HO Tech'),
      total: ut.length,
      completed,
      overdue,
      rate: ut.length ? Math.round((completed / ut.length) * 100) : 0,
    };
  });

  const members = users.filter(
    (u) =>
      u.role !== 'admin' &&
      userMemberships(u).some((m) => visibleUnits.includes(m.unit))
  );

  const perPerson: PersonPerf[] = members
    .map((m) => {
      const mt = scoped.filter((t) => (t.assigneeIds || []).includes(m.id));
      const completedTasks = mt.filter(
        (t) => t.status === 'COMPLETED' || t.status === 'ARCHIVED'
      );
      const pendingTasks = mt.filter(
        (t) => t.status !== 'COMPLETED' && t.status !== 'ARCHIVED'
      );
      return {
        name: m.name,
        unit: unitsForRole(m, visibleUnits, 'member')
          .concat(unitsForRole(m, visibleUnits, 'section_head'))
          .join(', '),
        post: m.designation || '—',
        postRank: designationRank(m),
        assignedTasks: mt,
        completedTasks,
        pendingTasks,
        assigned: mt.length,
        completed: completedTasks.length,
        rate: mt.length
          ? Math.round((completedTasks.length / mt.length) * 100)
          : 0,
        pending: pendingTasks.length,
      };
    })
    .sort((a, b) => b.assigned - a.assigned);

  // Completion trend last 6 months
  const now = new Date();
  const months = [...Array(6)].map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString('en-IN', { month: 'short' }),
    };
  });

  const trend = months.map((m) => {
    const count = scoped.filter((t) => {
      const doneEntry = (t.history || []).find((h) => h.status === 'COMPLETED');
      if (!doneEntry) return false;
      const d = new Date(doneEntry.at);
      return `${d.getFullYear()}-${d.getMonth()}` === m.key;
    }).length;
    return { month: m.label, completed: count };
  });

  const numCellStyle: React.CSSProperties = {
    cursor: 'pointer',
    textDecoration: 'underline',
    textDecorationStyle: 'dotted',
    textUnderlineOffset: '3px',
  };

  const sortColumns: Record<
    string,
    { type: 'text' | 'rank' | 'number'; accessor: (p: PersonPerf) => string | number }
  > = {
    name: { type: 'text', accessor: (p) => p.name },
    unit: { type: 'text', accessor: (p) => p.unit },
    post: { type: 'rank', accessor: (p) => p.postRank },
    assigned: { type: 'number', accessor: (p) => p.assigned },
    completed: { type: 'number', accessor: (p) => p.completed },
    rate: { type: 'number', accessor: (p) => p.rate },
    pending: { type: 'number', accessor: (p) => p.pending },
  };

  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null);

  const handleSort = (col: string) => {
    const type = sortColumns[col].type;
    if (sortCol !== col) {
      setSortCol(col);
      setSortDir(type === 'number' ? 'desc' : 'asc');
    } else {
      setSortDir((prev) => {
        if (type === 'number') return prev === 'desc' ? 'asc' : 'desc';
        return prev === 'asc' ? 'desc' : 'asc';
      });
    }
  };

  let displayedPerPerson = perPerson;
  if (sortCol) {
    const { accessor, type } = sortColumns[sortCol];
    displayedPerPerson = [...perPerson].sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);
      if (type === 'number' || type === 'rank') {
        return sortDir === 'desc'
          ? (bv as number) - (av as number)
          : (av as number) - (bv as number);
      }
      return sortDir === 'desc'
        ? String(bv).localeCompare(String(av))
        : String(av).localeCompare(String(bv));
    });
  }

  const SortableTh = ({
    col,
    children,
  }: {
    col: string;
    children: React.ReactNode;
  }) => (
    <th
      style={{ cursor: 'pointer', userSelect: 'none' }}
      onClick={() => handleSort(col)}
    >
      {children}
      <span style={{ marginLeft: 4, opacity: sortCol === col ? 1 : 0.3 }}>
        {sortCol === col ? (sortDir === 'desc' ? '▼' : '▲') : '↕'}
      </span>
    </th>
  );

  return (
    <div>
      <div
        className="tw-display"
        style={{
          fontSize: 24,
          fontWeight: 600,
          marginBottom: 18,
          color: 'var(--tw-ink)',
        }}
      >
        Analytics
      </div>

      {currentUser.role === 'admin' && (
        <>
          <div className="tw-section-title">
            <Building2 size={16} /> Team productivity by unit
          </div>
          <div
            className="tw-card"
            style={{ padding: 16, marginBottom: 22, height: 260 }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={perUnit}
                margin={{ top: 6, right: 10, left: -14, bottom: 6 }}
              >
                <CartesianGrid stroke="var(--tw-line)" vertical={false} />
                <XAxis
                  dataKey="unit"
                  tick={{ fontSize: 10, fill: '#4A5568' }}
                  interval={0}
                  angle={-18}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 11, fill: '#4A5568' }} />
                <Tooltip
                  contentStyle={{
                    fontFamily: 'IBM Plex Sans',
                    fontSize: 12,
                    borderRadius: 8,
                    border: '1px solid #E3E0D6',
                    boxShadow:
                      '0 2px 6px rgba(27,42,74,0.08), 0 4px 14px rgba(27,42,74,0.06)',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar
                  dataKey="completed"
                  name="Completed"
                  fill="#2F7A4D"
                  radius={[3, 3, 0, 0]}
                />
                <Bar
                  dataKey="overdue"
                  name="Overdue"
                  fill="#B23A2E"
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      <div className="tw-section-title">
        <Clock size={16} /> Completion trend (last 6 months)
      </div>
      <div
        className="tw-card"
        style={{ padding: 16, marginBottom: 22, height: 220 }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={trend}
            margin={{ top: 6, right: 10, left: -14, bottom: 6 }}
          >
            <CartesianGrid stroke="var(--tw-line)" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: '#4A5568' }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#4A5568' }}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                fontFamily: 'IBM Plex Sans',
                fontSize: 12,
                borderRadius: 8,
                border: '1px solid #E3E0D6',
                boxShadow:
                  '0 2px 6px rgba(27,42,74,0.08), 0 4px 14px rgba(27,42,74,0.06)',
              }}
            />
            <Line
              type="monotone"
              dataKey="completed"
              name="Completed tasks"
              stroke="var(--tw-steel)"
              strokeWidth={2.5}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="tw-section-title">
        <Users size={16} /> Individual performance
      </div>
      <div
        className="tw-mono"
        style={{
          fontSize: 10.5,
          color: 'var(--tw-ink-soft)',
          marginBottom: 8,
        }}
      >
        Click a column header to sort · click a number to see the underlying
        tasks.
      </div>
      <div className="tw-card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="tw-table">
          <thead>
            <tr>
              <SortableTh col="name">Name</SortableTh>
              <SortableTh col="unit">Unit</SortableTh>
              <SortableTh col="post">Post</SortableTh>
              <SortableTh col="assigned">Assigned</SortableTh>
              <SortableTh col="completed">Completed</SortableTh>
              <SortableTh col="rate">Completion rate</SortableTh>
              <SortableTh col="pending">Pending</SortableTh>
            </tr>
          </thead>
          <tbody>
            {displayedPerPerson.map((p) => (
              <tr key={p.name}>
                <td style={{ fontWeight: 600 }}>{p.name}</td>
                <td className="tw-mono" style={{ fontSize: 11.5 }}>
                  {p.unit}
                </td>
                <td className="tw-mono" style={{ fontSize: 11.5 }}>
                  {p.post}
                </td>
                <td
                  style={numCellStyle}
                  onClick={() =>
                    setListView({
                      title: `${p.name} — assigned tasks`,
                      personName: p.name,
                      field: 'assignedTasks',
                    })
                  }
                >
                  {p.assigned}
                </td>
                <td
                  style={numCellStyle}
                  onClick={() =>
                    setListView({
                      title: `${p.name} — completed tasks`,
                      personName: p.name,
                      field: 'completedTasks',
                    })
                  }
                >
                  {p.completed}
                </td>
                <td>
                  <span
                    className="tw-badge"
                    style={{
                      background:
                        (p.rate >= 70
                          ? '#2F7A4D'
                          : p.rate >= 40
                          ? '#C77D22'
                          : '#B23A2E') + '22',
                      color:
                        p.rate >= 70
                          ? '#2F7A4D'
                          : p.rate >= 40
                          ? '#C77D22'
                          : '#B23A2E',
                    }}
                  >
                    {p.rate}%
                  </span>
                </td>
                <td
                  style={{
                    ...numCellStyle,
                    color: p.pending ? 'var(--tw-gold)' : undefined,
                    fontWeight: p.pending ? 600 : 400,
                  }}
                  onClick={() =>
                    setListView({
                      title: `${p.name} — pending tasks`,
                      personName: p.name,
                      field: 'pendingTasks',
                    })
                  }
                >
                  {p.pending}
                </td>
              </tr>
            ))}
            {perPerson.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  style={{ color: 'var(--tw-ink-soft)', padding: 16 }}
                >
                  No team members defined for this unit yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {listView && (
        <TaskListModal
          title={listView.title}
          tasks={
            (
              perPerson.find((p) => p.name === listView.personName) ||
              ({} as PersonPerf)
            )[listView.field] || []
          }
          users={users}
          onOpen={(id) => onOpenTask(id)}
          onClose={() => setListView(null)}
        />
      )}
    </div>
  );
}
