import React, { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  Share2,
  Sparkles,
  RefreshCw,
  MessageCircle,
  Send,
  UserCheck,
  Building2,
  Phone,
  BookmarkCheck,
  CheckCheck,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Edit3,
  UserPlus,
  Users,
} from 'lucide-react';
import { Task, User, OfficeContact } from '../types';
import { generateWhatsAppMemoTemplate } from '../utils/pendencyAging';
import {
  formatIndianPhoneNumber,
  extractIndianMobileDigits,
  toWhatsAppDigits,
  isValidIndianMobile,
} from '../utils/phoneUtils';

type PresetStyle = 'report' | 'updates' | 'status' | 'update' | 'followup';

interface ContactOption {
  id: string;
  type: 'assignee' | 'section_head' | 'unit_officer' | 'office' | 'other_officer' | 'custom';
  userId?: string;
  label: string;
  sublabel: string;
  designation?: string;
  unit?: string;
  phone: string;
  contactPerson?: string;
}

export function WhatsAppActionModal({
  task,
  users = [],
  officeContacts = {},
  currentUser,
  onSaveOfficeContact,
  onSaveUserPhone,
  onClose,
  onLogReminder,
}: {
  task: Task;
  users?: User[];
  officeContacts?: Record<string, OfficeContact>;
  currentUser?: User | null;
  onSaveOfficeContact?: (office: string, contact: OfficeContact) => Promise<void> | void;
  onSaveUserPhone?: (userId: string, phone: string) => Promise<void> | void;
  onClose: () => void;
  onLogReminder?: (note: string) => Promise<void> | void;
}) {
  const [presetStyle, setPresetStyle] = useState<PresetStyle>('report');
  const [memoText, setMemoText] = useState<string>(() =>
    generateWhatsAppMemoTemplate({
      taskTitle: task.title,
      presetStyle: 'report',
    })
  );

  // Local overrides for phones updated inside modal (so UI updates instantly)
  const [userPhoneOverrides, setUserPhoneOverrides] = useState<Record<string, string>>({});
  const [officePhoneOverrides, setOfficePhoneOverrides] = useState<Record<string, string>>({});

  // Sender Phone (+91 86685 40396 by default for Harshad Yadav / user)
  const defaultSender = '+91 86685 40396';
  const [senderPhone, setSenderPhone] = useState<string>(() => {
    return (
      localStorage.getItem('officer_sender_whatsapp') ||
      currentUser?.phone ||
      defaultSender
    );
  });
  const [isEditingSender, setIsEditingSender] = useState<boolean>(false);
  const [senderInput, setSenderInput] = useState<string>(senderPhone);

  const handleSaveSenderPhone = () => {
    const digits = extractIndianMobileDigits(senderInput);
    if (digits.length === 10) {
      const formatted = formatIndianPhoneNumber(digits);
      setSenderPhone(formatted);
      localStorage.setItem('officer_sender_whatsapp', formatted);
      setIsEditingSender(false);
    }
  };

  // 1. Gather all explicit assignees related to this task
  const assignedUserIds = new Set<string>();
  if (task.assigneeId && task.assigneeId.trim()) {
    assignedUserIds.add(task.assigneeId.trim());
  }
  if (Array.isArray(task.assigneeIds)) {
    task.assigneeIds.forEach((id) => {
      if (id && id.trim()) assignedUserIds.add(id.trim());
    });
  }

  // 2. Gather task units
  const taskUnits = new Set<string>();
  if (task.unit && task.unit.trim()) {
    taskUnits.add(task.unit.trim());
  }
  if (Array.isArray(task.units)) {
    task.units.forEach((u) => {
      if (u && u.trim()) taskUnits.add(u.trim());
    });
  }

  // 3. Build recipient options
  const contactOptions: ContactOption[] = [];

  // Group A: All Assigned Officers related to the task
  assignedUserIds.forEach((uId) => {
    const foundUser = users.find((u) => u.id === uId);
    const rawPhone = userPhoneOverrides[uId] !== undefined ? userPhoneOverrides[uId] : (foundUser?.phone || '');
    contactOptions.push({
      id: `assignee_${uId}`,
      type: 'assignee',
      userId: uId,
      label: foundUser ? foundUser.name : uId,
      sublabel: foundUser?.designation ? `Assigned (${foundUser.designation})` : 'Task Assignee',
      designation: foundUser?.designation,
      unit: foundUser?.unit || undefined,
      phone: rawPhone,
    });
  });

  // Group B: Unit Officers / Section Heads for task units (if not already in assignees)
  users.forEach((u) => {
    if (assignedUserIds.has(u.id)) return;
    const isHead =
      u.memberships?.some((m) => taskUnits.has(m.unit) && m.role === 'section_head') ||
      (u.unit && taskUnits.has(u.unit) && u.role === 'section_head');

    if (isHead) {
      const rawPhone = userPhoneOverrides[u.id] !== undefined ? userPhoneOverrides[u.id] : (u.phone || '');
      contactOptions.push({
        id: `head_${u.id}`,
        type: 'section_head',
        userId: u.id,
        label: u.name,
        sublabel: `Section Head (${u.unit || Array.from(taskUnits)[0] || 'Unit'})`,
        designation: u.designation,
        unit: u.unit || undefined,
        phone: rawPhone,
      });
    }
  });

  // If no explicit assignees or section heads found, add unit members as related officers
  if (contactOptions.length === 0 && taskUnits.size > 0) {
    users.forEach((u) => {
      const isMember = u.memberships?.some((m) => taskUnits.has(m.unit)) || (u.unit && taskUnits.has(u.unit));
      if (isMember) {
        const rawPhone = userPhoneOverrides[u.id] !== undefined ? userPhoneOverrides[u.id] : (u.phone || '');
        contactOptions.push({
          id: `unit_member_${u.id}`,
          type: 'unit_officer',
          userId: u.id,
          label: u.name,
          sublabel: u.designation ? `${u.designation} (${u.unit})` : `Unit Officer (${u.unit})`,
          designation: u.designation,
          unit: u.unit || undefined,
          phone: rawPhone,
        });
      }
    });
  }

  // Group C: Pending Office Desk Contact
  const pendingOffice = task.pendingAtOffice || (task.pendingAt && task.pendingAt[0]);
  if (pendingOffice) {
    const offContact = officeContacts[pendingOffice];
    const offPhone =
      officePhoneOverrides[pendingOffice] !== undefined
        ? officePhoneOverrides[pendingOffice]
        : offContact?.phone || '';
    contactOptions.push({
      id: `office_${pendingOffice}`,
      type: 'office',
      label: pendingOffice,
      sublabel: offContact?.contactPerson ? `Desk: ${offContact.contactPerson}` : 'Pending Office Desk',
      phone: offPhone,
      contactPerson: offContact?.contactPerson,
    });
  }

  // Custom fallback option
  contactOptions.push({
    id: 'custom_contact',
    type: 'custom',
    label: 'Custom Phone Number',
    sublabel: 'Enter any 10-digit Indian WhatsApp mobile number',
    phone: '',
  });

  const [selectedContactId, setSelectedContactId] = useState<string>(
    contactOptions[0]?.id || 'custom_contact'
  );

  const selectedContact = contactOptions.find((c) => c.id === selectedContactId) || contactOptions[0];

  const [activePhone, setActivePhone] = useState<string>(selectedContact?.phone || '');
  const [savedPhoneSuccess, setSavedPhoneSuccess] = useState<boolean>(false);
  const [selectedOtherUserId, setSelectedOtherUserId] = useState<string>('');

  // Update activePhone when contact selection changes
  useEffect(() => {
    if (selectedContact) {
      setActivePhone(selectedContact.phone || '');
      setSavedPhoneSuccess(false);
    }
  }, [selectedContactId]);

  // AI & Dispatch State
  const [loadingAI, setLoadingAI] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [aiSource, setAiSource] = useState<'gemini' | 'template'>('template');
  const [quotaNotice, setQuotaNotice] = useState<boolean>(false);
  const [logged, setLogged] = useState<boolean>(false);

  // Real WhatsApp Dispatch State
  const [dispatchResult, setDispatchResult] = useState<{
    recipientFormatted: string;
    recipientName: string;
    senderNumber: string;
    waUrl: string;
    savedToProfile?: boolean;
  } | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);

  // Handle selecting any other officer from the division directory
  const handleSelectOtherOfficer = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const uId = e.target.value;
    if (!uId) return;
    const targetUser = users.find((u) => u.id === uId);
    if (!targetUser) return;

    setSelectedOtherUserId(uId);

    // If already in contactOptions, select it
    const existing = contactOptions.find((c) => c.userId === uId);
    if (existing) {
      setSelectedContactId(existing.id);
    } else {
      // Add dynamically as other_officer
      const customId = `other_${uId}`;
      const rawPhone = userPhoneOverrides[uId] !== undefined ? userPhoneOverrides[uId] : (targetUser.phone || '');
      const newOpt: ContactOption = {
        id: customId,
        type: 'other_officer',
        userId: uId,
        label: targetUser.name,
        sublabel: targetUser.designation ? `Officer (${targetUser.designation})` : 'Officer',
        designation: targetUser.designation,
        unit: targetUser.unit || undefined,
        phone: rawPhone,
      };
      contactOptions.splice(contactOptions.length - 1, 0, newOpt);
      setSelectedContactId(customId);
      setActivePhone(rawPhone);
    }
  };

  // Call server-side Gemini API on request
  const fetchAIMemo = async (styleToUse: PresetStyle = presetStyle) => {
    setLoadingAI(true);
    setQuotaNotice(false);
    try {
      const res = await fetch('/api/generate-whatsapp-memo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskTitle: task.title,
          presetStyle: styleToUse,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.quotaExceeded) {
          setQuotaNotice(true);
        }
        if (data.memo && data.memo.trim().length > 0) {
          setMemoText(data.memo.trim());
          setAiSource(data.source === 'gemini' ? 'gemini' : 'template');
          setLoadingAI(false);
          return;
        }
      }
    } catch {
      // offline / local fallback
    }

    const fallback = generateWhatsAppMemoTemplate({
      taskTitle: task.title,
      presetStyle: styleToUse,
    });
    setMemoText(fallback);
    setAiSource('template');
    setLoadingAI(false);
  };

  const handleApplyPreset = (style: PresetStyle) => {
    setPresetStyle(style);
    const msg = generateWhatsAppMemoTemplate({
      taskTitle: task.title,
      presetStyle: style,
    });
    setMemoText(msg);
    setAiSource('template');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(memoText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      const el = document.createElement('textarea');
      el.value = memoText;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    }
  };

  // Explicit Save Phone Number to Officer or Office Profile
  const handleSavePhoneToDirectory = async () => {
    const mobile10 = extractIndianMobileDigits(activePhone);
    if (!mobile10 || mobile10.length !== 10) {
      setDispatchError('Please enter a valid 10-digit Indian WhatsApp mobile number before saving.');
      return;
    }
    const formatted = formatIndianPhoneNumber(mobile10);

    // Save to Officer User Profile
    if (selectedContact?.userId && onSaveUserPhone) {
      await onSaveUserPhone(selectedContact.userId, formatted);
      setUserPhoneOverrides((prev) => ({ ...prev, [selectedContact.userId!]: formatted }));
      setActivePhone(formatted);
      setSavedPhoneSuccess(true);
      setTimeout(() => setSavedPhoneSuccess(false), 3500);
      return;
    }

    // Save to Office Desk Directory
    if (selectedContact?.type === 'office' && pendingOffice && onSaveOfficeContact) {
      const existing = officeContacts[pendingOffice] || {};
      await onSaveOfficeContact(pendingOffice, {
        ...existing,
        phone: formatted,
        contactPerson: existing.contactPerson || selectedContact.contactPerson,
      });
      setOfficePhoneOverrides((prev) => ({ ...prev, [pendingOffice]: formatted }));
      setActivePhone(formatted);
      setSavedPhoneSuccess(true);
      setTimeout(() => setSavedPhoneSuccess(false), 3500);
    }
  };

  // Primary Action: Genuine WhatsApp Send
  // Opens WhatsApp directly with recipient and message pre-filled.
  // Sends from the user's authenticated WhatsApp account (+91 86685 40396).
  const handleSendWhatsApp = async (forceWeb = false) => {
    setDispatchError(null);

    const mobile10 = extractIndianMobileDigits(activePhone);
    if (!mobile10 || mobile10.length !== 10) {
      setDispatchError('Please enter a valid 10-digit Indian WhatsApp mobile number (e.g. 98220 12345).');
      return;
    }

    const recipientFormatted = formatIndianPhoneNumber(mobile10);
    const waDigits = `91${mobile10}`;
    const encoded = encodeURIComponent(memoText.trim());

    // Generate universal link (wa.me) or web-specific link
    const waUrl = forceWeb
      ? `https://web.whatsapp.com/send?phone=${waDigits}&text=${encoded}`
      : `https://wa.me/${waDigits}?text=${encoded}`;

    // Launch WhatsApp safely WITHOUT navigating the current SPA window away!
    // Using an anchor with target="_blank" allows mobile browsers (Android Chrome, iOS Safari)
    // to open the WhatsApp native app without unloading or reloading the Task Register webapp.
    const link = document.createElement('a');
    link.href = waUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      try {
        if (link.parentNode) link.parentNode.removeChild(link);
      } catch {}
    }, 500);

    let savedToProfile = false;

    // Automatically save phone to officer profile if not already saved or if updated
    if (selectedContact?.userId && onSaveUserPhone) {
      const prevPhone = selectedContact.phone;
      if (!prevPhone || extractIndianMobileDigits(prevPhone) !== mobile10) {
        await onSaveUserPhone(selectedContact.userId, recipientFormatted);
        setUserPhoneOverrides((prev) => ({ ...prev, [selectedContact.userId!]: recipientFormatted }));
        savedToProfile = true;
      }
    } else if (selectedContact?.type === 'office' && pendingOffice && onSaveOfficeContact) {
      const existing = officeContacts[pendingOffice] || {};
      if (!existing.phone || extractIndianMobileDigits(existing.phone) !== mobile10) {
        await onSaveOfficeContact(pendingOffice, {
          ...existing,
          phone: recipientFormatted,
          contactPerson: existing.contactPerson || selectedContact.contactPerson,
        });
        setOfficePhoneOverrides((prev) => ({ ...prev, [pendingOffice]: recipientFormatted }));
        savedToProfile = true;
      }
    }

    // Set feedback state
    setDispatchResult({
      recipientFormatted,
      recipientName: selectedContact?.label || 'Officer',
      senderNumber: senderPhone,
      waUrl,
      savedToProfile,
    });

    // Auto-log reminder in file notes/remarks
    if (onLogReminder) {
      const logNote = `[WhatsApp Sent by ${senderPhone}] Sent to ${selectedContact?.label || 'Officer'} (${recipientFormatted}): "${memoText.replace(/\n/g, ' ')}"`;
      await onLogReminder(logNote);
      setLogged(true);
    }
  };

  const handleManualLogReminder = async () => {
    if (!onLogReminder || logged) return;
    const recipientInfo = activePhone ? ` to ${selectedContact?.label} (${formatIndianPhoneNumber(activePhone)})` : '';
    const note = `[WhatsApp Note Logged by ${senderPhone}] Message${recipientInfo}: "${memoText.replace(/\n/g, ' ')}"`;
    await onLogReminder(note);
    setLogged(true);
  };

  // Helper to render formatted bold preview for text with *asterisks*
  const renderFormattedPreview = (raw: string) => {
    const lines = raw.split('\n');
    return lines.map((line, lIdx) => {
      const parts = line.split(/(\*[^*]+\*)/g);
      return (
        <div key={lIdx} style={{ minHeight: '1.4em' }}>
          {parts.map((p, pIdx) => {
            if (p.startsWith('*') && p.endsWith('*') && p.length > 2) {
              return (
                <strong key={pIdx} style={{ fontWeight: 700, color: '#111827' }}>
                  {p.slice(1, -1)}
                </strong>
              );
            }
            return <span key={pIdx}>{p}</span>;
          })}
        </div>
      );
    });
  };

  // Other officers not already listed in contact options (for dropdown)
  const existingUserIds = new Set(contactOptions.map((c) => c.userId).filter(Boolean));
  const otherAssignableUsers = users.filter((u) => !existingUserIds.has(u.id));

  return (
    <div className="tw-modal-overlay" onClick={onClose}>
      <div
        className="tw-modal"
        style={{ maxWidth: 620, maxHeight: '94vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="tw-modal-head"
          style={{
            background: 'linear-gradient(135deg, #075E54 0%, #128C7E 100%)',
            color: '#FFFFFF',
            borderBottom: 'none',
            padding: '14px 18px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: '#25D366',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
              }}
            >
              <MessageCircle size={20} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 0.2 }}>
                WhatsApp Dispatch &amp; Follow-up
              </div>
              <div
                style={{
                  fontSize: 11,
                  opacity: 0.94,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <ShieldCheck size={12} /> Dispatches from {senderPhone} • Direct Delivery
              </div>
            </div>
          </div>
          <button
            type="button"
            className="tw-iconbtn"
            style={{ color: '#FFFFFF', background: 'rgba(255,255,255,0.15)' }}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <div className="tw-modal-body" style={{ padding: '16px 18px', overflowY: 'auto' }}>
          {/* Sender Account Card (Shows message will be sent from +91 86685 40396) */}
          <div
            style={{
              background: '#F0FDF4',
              border: '1.5px solid #86EFAC',
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: '#22C55E',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                ✓
              </div>
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: '#166534',
                    fontFamily: 'IBM Plex Mono',
                  }}
                >
                  Sender WhatsApp Account:
                </div>
                {isEditingSender ? (
                  <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#14532D' }}>🇮🇳 +91</div>
                    <input
                      type="tel"
                      className="tw-input"
                      style={{ fontSize: 12, padding: '3px 8px', width: 140, fontWeight: 600 }}
                      value={extractIndianMobileDigits(senderInput)}
                      onChange={(e) => setSenderInput(e.target.value)}
                    />
                    <button
                      type="button"
                      className="tw-btn"
                      style={{ fontSize: 11, padding: '3px 8px', background: '#166534', color: '#FFF' }}
                      onClick={handleSaveSenderPhone}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="tw-btn tw-btn-ghost"
                      style={{ fontSize: 11, padding: '3px 6px' }}
                      onClick={() => setIsEditingSender(false)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 1 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: '#14532D', fontFamily: 'IBM Plex Mono' }}>
                      {senderPhone}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        background: '#DCFCE7',
                        color: '#15803D',
                        padding: '1px 6px',
                        borderRadius: 4,
                        border: '1px solid #BBF7D0',
                      }}
                    >
                      Verified Officer
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSenderInput(senderPhone);
                        setIsEditingSender(true);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#166534',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        fontSize: 10.5,
                        textDecoration: 'underline',
                      }}
                      title="Edit sender mobile number"
                    >
                      <Edit3 size={11} /> Edit
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div style={{ fontSize: 10.5, color: '#166534', maxWidth: 210, lineHeight: 1.3, textAlign: 'right' }}>
              Messages will be received showing <strong>{senderPhone}</strong> as the sender.
            </div>
          </div>

          {/* Recipient Selection Section (All Assignees Related to Task) */}
          <div
            style={{
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: 8,
              padding: '12px 14px',
              marginBottom: 14,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontFamily: 'IBM Plex Mono',
                  fontWeight: 700,
                  color: 'var(--tw-steel)',
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <Users size={12} /> Select Assignee / Recipient:
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--tw-ink-soft)' }}>
                {assignedUserIds.size > 0
                  ? `${assignedUserIds.size} assignee${assignedUserIds.size > 1 ? 's' : ''} on this task`
                  : 'No explicit assignees allocated'}
              </div>
            </div>

            {/* Recipient Selector Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6, marginBottom: 10 }}>
              {contactOptions.map((opt) => {
                const isSelected = opt.id === selectedContactId;
                const currentOptPhone =
                  opt.userId && userPhoneOverrides[opt.userId] !== undefined
                    ? userPhoneOverrides[opt.userId]
                    : opt.type === 'office' && officePhoneOverrides[opt.label] !== undefined
                    ? officePhoneOverrides[opt.label]
                    : opt.phone;
                const hasPhone = !!currentOptPhone;

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedContactId(opt.id)}
                    style={{
                      border: isSelected ? '2px solid #059669' : '1px solid #CBD5E1',
                      background: isSelected ? '#ECFDF5' : '#FFFFFF',
                      color: isSelected ? '#065F46' : 'var(--tw-ink)',
                      borderRadius: 6,
                      padding: '7px 10px',
                      fontSize: 11.5,
                      fontWeight: isSelected ? 600 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      textAlign: 'left',
                      boxShadow: isSelected ? '0 1px 3px rgba(5,150,105,0.2)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ marginTop: 2 }}>
                      {opt.type === 'office' ? (
                        <Building2 size={15} color={isSelected ? '#059669' : 'var(--tw-steel)'} />
                      ) : opt.type === 'assignee' || opt.type === 'section_head' || opt.type === 'other_officer' ? (
                        <UserCheck size={15} color={isSelected ? '#059669' : 'var(--tw-steel)'} />
                      ) : (
                        <Phone size={15} color={isSelected ? '#059669' : 'var(--tw-steel)'} />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 12,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {opt.label}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: isSelected ? '#047857' : 'var(--tw-ink-soft)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          marginBottom: 3,
                        }}
                      >
                        {opt.sublabel}
                      </div>
                      <div>
                        {hasPhone ? (
                          <span
                            style={{
                              fontSize: 9.5,
                              color: '#047857',
                              background: '#D1FAE5',
                              padding: '1px 5px',
                              borderRadius: 3,
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                            }}
                          >
                            <Phone size={9} /> {currentOptPhone}
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: 9.5,
                              color: '#B45309',
                              background: '#FEF3C7',
                              padding: '1px 5px',
                              borderRadius: 3,
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                            }}
                          >
                            <AlertCircle size={9} /> No phone saved
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Dropdown to select any other officer from division directory if not in the list */}
            {otherAssignableUsers.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 10,
                  padding: '6px 10px',
                  background: '#FFFFFF',
                  borderRadius: 6,
                  border: '1px dashed #CBD5E1',
                }}
              >
                <UserPlus size={13} color="var(--tw-steel)" />
                <span style={{ fontSize: 11, color: 'var(--tw-steel)', whiteSpace: 'nowrap' }}>
                  Pick any other officer:
                </span>
                <select
                  className="tw-select"
                  style={{ fontSize: 11.5, padding: '4px 8px', flex: 1 }}
                  value={selectedOtherUserId}
                  onChange={handleSelectOtherOfficer}
                >
                  <option value="">-- Choose another officer from directory --</option>
                  {otherAssignableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} {u.designation ? `(${u.designation})` : ''} {u.phone ? `• ${u.phone}` : '• No phone'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* WhatsApp Number Input for Selected Recipient with +91 and Save button */}
            <div
              style={{
                background: '#FFFFFF',
                border: '1.5px solid #CBD5E1',
                borderRadius: 6,
                padding: '10px 12px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 6,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Phone size={12} color="#059669" />
                  <span>
                    WhatsApp Number for <strong>{selectedContact?.label}</strong>:
                  </span>
                </div>
                {selectedContact?.phone ? (
                  <span style={{ fontSize: 10.5, color: '#059669', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <Check size={11} /> Saved in directory
                  </span>
                ) : (
                  <span style={{ fontSize: 10.5, color: '#D97706', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <AlertCircle size={11} /> Not saved yet — enter below to save permanently
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'stretch', flex: 1, minWidth: 260 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '0 10px',
                      background: '#ECFDF5',
                      border: '1px solid #10B981',
                      borderRight: 'none',
                      borderRadius: '6px 0 0 6px',
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: '#065F46',
                      fontFamily: 'IBM Plex Mono, monospace',
                      userSelect: 'none',
                      whiteSpace: 'nowrap',
                    }}
                    title="Default Indian WhatsApp Prefix (+91)"
                  >
                    <span style={{ fontSize: 13 }}>🇮🇳</span> +91
                  </div>
                  <input
                    type="tel"
                    className="tw-input"
                    style={{
                      borderRadius: '0 6px 6px 0',
                      fontSize: 13,
                      padding: '7px 10px',
                      fontWeight: 600,
                      color: '#065F46',
                      flex: 1,
                    }}
                    placeholder={`10-digit mobile for ${selectedContact?.label || 'recipient'} (e.g. 98220 12345)`}
                    value={extractIndianMobileDigits(activePhone)}
                    onChange={(e) => {
                      const raw = extractIndianMobileDigits(e.target.value);
                      setActivePhone(raw ? formatIndianPhoneNumber(raw) : '');
                    }}
                  />
                </div>

                {/* Explicit Save to Directory Button for selected officer or office */}
                {(selectedContact?.userId || selectedContact?.type === 'office') && (
                  <button
                    type="button"
                    className="tw-btn"
                    style={{
                      background: savedPhoneSuccess ? '#059669' : '#047857',
                      color: '#FFFFFF',
                      fontSize: 12,
                      padding: '7px 12px',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                    onClick={handleSavePhoneToDirectory}
                    disabled={extractIndianMobileDigits(activePhone).length !== 10}
                    title={`Save this WhatsApp number permanently to ${selectedContact.label}'s directory profile`}
                  >
                    {savedPhoneSuccess ? (
                      <>
                        <Check size={14} /> Saved to Profile!
                      </>
                    ) : (
                      <>
                        <BookmarkCheck size={14} /> Save to {selectedContact.label}'s Profile
                      </>
                    )}
                  </button>
                )}
              </div>

              {savedPhoneSuccess && (
                <div style={{ marginTop: 6, fontSize: 11, color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <CheckCheck size={13} /> WhatsApp number saved to {selectedContact?.label}'s profile. It will now be loaded automatically on all tasks!
                </div>
              )}
            </div>
          </div>

          {/* Phrasing Selector */}
          <div style={{ marginBottom: 12 }}>
            <div
              style={{
                fontSize: 11,
                fontFamily: 'IBM Plex Mono',
                fontWeight: 600,
                color: 'var(--tw-ink-soft)',
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              Choose Phrasing Style:
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`tw-unit-tab ${presetStyle === 'report' ? 'active' : ''}`}
                style={{ fontSize: 11.5, padding: '4px 10px' }}
                onClick={() => handleApplyPreset('report')}
              >
                pl report me on...
              </button>
              <button
                type="button"
                className={`tw-unit-tab ${presetStyle === 'updates' ? 'active' : ''}`}
                style={{ fontSize: 11.5, padding: '4px 10px' }}
                onClick={() => handleApplyPreset('updates')}
              >
                pl give updates of...
              </button>
              <button
                type="button"
                className={`tw-unit-tab ${presetStyle === 'status' ? 'active' : ''}`}
                style={{ fontSize: 11.5, padding: '4px 10px' }}
                onClick={() => handleApplyPreset('status')}
              >
                what is the status of...?
              </button>
              <button
                type="button"
                className={`tw-unit-tab ${presetStyle === 'update' ? 'active' : ''}`}
                style={{ fontSize: 11.5, padding: '4px 10px' }}
                onClick={() => handleApplyPreset('update')}
              >
                pl update me on...
              </button>
              <button
                type="button"
                className={`tw-unit-tab ${presetStyle === 'followup' ? 'active' : ''}`}
                style={{ fontSize: 11.5, padding: '4px 10px' }}
                onClick={() => handleApplyPreset('followup')}
              >
                pl take follow up for...
              </button>
            </div>
          </div>

          {/* WhatsApp Message Preview Bubble */}
          <div style={{ marginBottom: 12 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontFamily: 'IBM Plex Mono',
                  fontWeight: 600,
                  color: 'var(--tw-ink-soft)',
                  textTransform: 'uppercase',
                }}
              >
                WhatsApp Message Preview:
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {loadingAI ? (
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--tw-steel)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <RefreshCw size={11} className="animate-spin" /> Drafting...
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: 10.5,
                      color: aiSource === 'gemini' ? '#065F46' : 'var(--tw-ink-soft)',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Sparkles size={11} />{' '}
                    {aiSource === 'gemini'
                      ? 'Gemini AI Formatted'
                      : quotaNotice
                      ? 'Direct Format (Daily AI limit reached)'
                      : 'Direct 1-Line Format'}
                  </span>
                )}
                <button
                  type="button"
                  className="tw-btn tw-btn-ghost"
                  style={{ padding: '2px 8px', fontSize: 11 }}
                  onClick={() => fetchAIMemo(presetStyle)}
                  disabled={loadingAI}
                  title="Enhance message with AI"
                >
                  <RefreshCw size={11} /> Enhance with AI
                </button>
              </div>
            </div>

            {/* Chat background texture container */}
            <div
              style={{
                background: '#E5DDD5',
                backgroundImage: 'radial-gradient(#CBC3B9 1px, transparent 1px)',
                backgroundSize: '16px 16px',
                borderRadius: 8,
                padding: '14px 16px',
                border: '1px solid #D1D5DB',
              }}
            >
              <div
                style={{
                  background: '#DCF8C6',
                  borderRadius: '8px 8px 0px 8px',
                  padding: '10px 14px 6px 14px',
                  fontSize: 13.5,
                  lineHeight: 1.45,
                  color: '#111827',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                  position: 'relative',
                  marginLeft: 'auto',
                  maxWidth: '96%',
                  border: '1px solid #C4E9A7',
                }}
              >
                {renderFormattedPreview(memoText)}

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: 4,
                    fontSize: 10,
                    color: '#6B7280',
                    marginTop: 4,
                  }}
                >
                  <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <span style={{ color: '#34B7F1', fontWeight: 700 }}>✓✓</span>
                </div>
              </div>
            </div>
          </div>

          {/* Editable raw message area */}
          <div style={{ marginBottom: 12 }}>
            <label className="tw-label">
              <span>Message Text (editable):</span>
            </label>
            <input
              type="text"
              className="tw-input"
              style={{
                fontSize: 13,
                padding: '8px 10px',
                background: '#FAFAFA',
              }}
              value={memoText}
              onChange={(e) => setMemoText(e.target.value)}
            />
          </div>

          {/* Guaranteed Delivery & Security Info Note */}
          <div
            style={{
              background: '#F8FAFC',
              border: '1px solid #CBD5E1',
              borderRadius: 6,
              padding: '8px 12px',
              fontSize: 11,
              color: '#334155',
              lineHeight: 1.4,
              marginBottom: 12,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
            }}
          >
            <ShieldCheck size={16} color="#059669" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <strong>Guaranteed WhatsApp Delivery from {senderPhone}:</strong> Tapping "Send via WhatsApp" launches WhatsApp directly with your verified account. The recipient will see <strong>{senderPhone}</strong> as the sender, ensuring authentic delivery. Any new phone number entered is also automatically saved to that officer's profile.
            </div>
          </div>

          {/* Dispatch Feedback Banner */}
          {dispatchResult && (
            <div
              style={{
                background: '#ECFDF5',
                border: '1.5px solid #10B981',
                borderRadius: 8,
                padding: '12px 14px',
                marginBottom: 12,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
              }}
            >
              <CheckCheck size={22} color="#059669" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#065F46' }}>
                  ✓ WhatsApp Opened for {dispatchResult.recipientName} ({dispatchResult.recipientFormatted})!
                </div>
                <div style={{ fontSize: 11.5, color: '#047857', marginTop: 2 }}>
                  Message is ready in WhatsApp. Sending directly from your number: <strong>{dispatchResult.senderNumber}</strong>. Follow-up reminder has been logged into file remarks.
                  {dispatchResult.savedToProfile && (
                    <span style={{ fontWeight: 700, marginLeft: 4 }}>
                      • WhatsApp mobile number permanently saved to {dispatchResult.recipientName}'s profile!
                    </span>
                  )}
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <a
                    href={dispatchResult.waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: '#065F46',
                      textDecoration: 'underline',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <ExternalLink size={12} /> Re-launch WhatsApp Chat
                  </a>
                </div>
              </div>
            </div>
          )}

          {dispatchError && (
            <div
              style={{
                background: '#FEF2F2',
                border: '1.5px solid #EF4444',
                borderRadius: 8,
                padding: '10px 14px',
                marginBottom: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12.5,
                color: '#991B1B',
              }}
            >
              <AlertCircle size={16} color="#DC2626" />
              <span>{dispatchError}</span>
            </div>
          )}

          {/* Action Button Bar */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              borderTop: '1px solid var(--tw-line)',
              paddingTop: 12,
            }}
          >
            <div>
              {onLogReminder && (
                <button
                  type="button"
                  className="tw-btn tw-btn-ghost"
                  style={{
                    fontSize: 12,
                    padding: '7px 12px',
                    color: logged ? 'var(--tw-green)' : 'var(--tw-ink)',
                  }}
                  onClick={handleManualLogReminder}
                  disabled={logged}
                  title="Save reminder note directly into task remarks without launching WhatsApp"
                >
                  {logged ? (
                    <>
                      <Check size={13} color="var(--tw-green)" /> Logged in File Notes
                    </>
                  ) : (
                    <>Log in File Notes Only</>
                  )}
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="tw-btn tw-btn-ghost"
                style={{
                  fontSize: 12.5,
                  padding: '7px 12px',
                }}
                onClick={handleCopy}
              >
                {copied ? (
                  <>
                    <Check size={13} color="var(--tw-green)" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy size={13} /> Copy Text
                  </>
                )}
              </button>

              <button
                type="button"
                className="tw-btn tw-btn-ghost"
                style={{
                  fontSize: 12.5,
                  padding: '7px 12px',
                  color: '#075E54',
                  borderColor: '#CBD5E1',
                }}
                onClick={() => handleSendWhatsApp(true)}
                title="Open WhatsApp Web in desktop browser"
              >
                <Share2 size={13} /> Open Web
              </button>

              {/* Primary Dispatch Action Button: Opens WhatsApp directly from Sender Number */}
              <button
                type="button"
                className="tw-btn"
                style={{
                  background: '#25D366',
                  borderColor: '#22BF5B',
                  color: '#FFFFFF',
                  fontSize: 13,
                  fontWeight: 600,
                  padding: '8px 16px',
                  boxShadow: '0 2px 8px rgba(37,211,102,0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                }}
                onClick={() => handleSendWhatsApp(false)}
                disabled={!activePhone.trim()}
                title={`Deliver message directly from your WhatsApp number (${senderPhone})`}
              >
                <Send size={14} /> Send via WhatsApp ({senderPhone})
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
