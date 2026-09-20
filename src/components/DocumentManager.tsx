import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit2,
  Printer,
  Upload,
  Calendar,
  User,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Paperclip,
  X,
  Eye,
  FileCheck,
  ShieldAlert,
} from 'lucide-react';
import { STAFF_LIST, SCHOOL_NAME, SCHOOL_DISTRICT, SCHOOL_OFFICE } from '../data/staff';
import { SchoolDocument, DocumentCategory, UserSession } from '../types';
import {
  saveSchoolDocument,
  subscribeToSchoolDocuments,
  deleteSchoolDocument,
} from '../services/firebase';
import { sendBrowserPushNotification } from '../services/notificationService';
import { toKhmer } from '../utils/khmerCalendar';

interface DocumentManagerProps {
  currentUser: UserSession;
}

const CATEGORY_LABELS: Record<DocumentCategory, { label: string; color: string; icon: string }> = {
  absence_record: { label: 'កំណត់ត្រាគ្រូអវត្តមាន', color: 'bg-rose-500/20 text-rose-300 border-rose-500/40', icon: '⚠️' },
  leave_request: { label: 'លិខិតសុំច្បាប់', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40', icon: '📝' },
  mission_letter: { label: 'លិខិតបេសកកម្ម', color: 'bg-blue-500/20 text-blue-300 border-blue-500/40', icon: '🚗' },
  holiday_notice: { label: 'សេចក្តីជូនដំណឹងថ្ងៃបុណ្យ', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40', icon: '🏖️' },
  official_letter: { label: 'លិខិតរដ្ឋបាលទូទៅ', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', icon: '📜' },
  other: { label: 'ឯកសារផ្សេងៗ', color: 'bg-slate-500/20 text-slate-300 border-slate-500/40', icon: '📁' },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'រង់ចាំពិនិត្យ', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  approved: { label: 'បានអនុម័ត', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  resolved: { label: 'បានដោះស្រាយរួច', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  archived: { label: 'រក្សាទុកក្នុងបណ្ណសារ', color: 'bg-slate-500/20 text-slate-400 border-slate-600' },
};

export default function DocumentManager({ currentUser }: DocumentManagerProps) {
  const [documents, setDocuments] = useState<SchoolDocument[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingDoc, setEditingDoc] = useState<SchoolDocument | null>(null);
  const [viewingDoc, setViewingDoc] = useState<SchoolDocument | null>(null);

  // Form fields
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('absence_record');
  const [staffName, setStaffName] = useState(currentUser.name);
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<'pending' | 'approved' | 'resolved' | 'archived'>('approved');
  const [fileAttachmentUrl, setFileAttachmentUrl] = useState<string>('');
  const [attachmentName, setAttachmentName] = useState<string>('');

  // Real-time subscribe to documents collection
  useEffect(() => {
    const unsub = subscribeToSchoolDocuments((docs) => {
      setDocuments(docs);
    });
    return () => unsub();
  }, []);

  const openNewModal = (defaultCategory: DocumentCategory = 'absence_record') => {
    setEditingDoc(null);
    setTitle('');
    setCategory(defaultCategory);
    setStaffName(currentUser.name);
    setDate(new Date().toISOString().split('T')[0]);
    setReferenceNumber('');
    setContent('');
    setStatus('approved');
    setFileAttachmentUrl('');
    setAttachmentName('');
    setIsModalOpen(true);
  };

  const openEditModal = (docItem: SchoolDocument) => {
    setEditingDoc(docItem);
    setTitle(docItem.title);
    setCategory(docItem.category);
    setStaffName(docItem.staffName || '');
    setDate(docItem.date);
    setReferenceNumber(docItem.referenceNumber || '');
    setContent(docItem.content);
    setStatus(docItem.status);
    setFileAttachmentUrl(docItem.fileAttachmentUrl || '');
    setAttachmentName(docItem.attachmentName || '');
    setIsModalOpen(true);
  };

  // Handle file upload (converts to data URL preview)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (< 4MB for Firestore doc safety)
    if (file.size > 4 * 1024 * 1024) {
      alert('ទំហំឯកសារធំពេក (សូមប្រើរូបភាព ឬឯកសារក្រោម 4MB)');
      return;
    }

    setAttachmentName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setFileAttachmentUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Submit Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      alert('សូមបញ្ចូលចំណងជើង និងខ្លឹមសារឯកសារឱ្យបានពេញលេញ!');
      return;
    }

    setIsSaving(true);
    const docPayload: SchoolDocument = {
      id: editingDoc?.id,
      title: title.trim(),
      category,
      staffName: staffName || undefined,
      date,
      referenceNumber: referenceNumber.trim() || undefined,
      content: content.trim(),
      status,
      fileAttachmentUrl: fileAttachmentUrl || undefined,
      attachmentName: attachmentName || undefined,
      createdBy: currentUser.name,
    };

    const res = await saveSchoolDocument(docPayload);
    setIsSaving(false);

    if (res.success) {
      setIsModalOpen(false);

      // Trigger Browser Push Notification
      const catLabel = CATEGORY_LABELS[category]?.label || 'ឯកសារ';
      sendBrowserPushNotification({
        title: category === 'leave_request' ? '📋 ពាក្យសុំច្បាប់ថ្មី' : category === 'absence_record' ? '⚠️ កំណត់ត្រាគ្រូអវត្តមាន' : '📁 ឯកសារ/កំណត់ត្រាថ្មី',
        body: `${staffName ? `${staffName}៖ ` : ''}${title.trim()} (${catLabel})`,
        type: category === 'leave_request' ? 'leave' : 'edit',
        staffName: staffName || undefined,
      });
    } else {
      alert('មានបញ្ហាក្នុងការរក្សាទុក៖ ' + res.error);
    }
  };

  const handleDelete = async (id?: string) => {
    if (!id) return;
    if (confirm('តើលោកអ្នកពិតជាចង់លុបឯកសារ/កំណត់ត្រានេះចេញពី Firestore មែនទេ?')) {
      await deleteSchoolDocument(id);
      if (viewingDoc?.id === id) setViewingDoc(null);
    }
  };

  // Filtered documents
  const filteredDocs = documents.filter((d) => {
    const matchesCategory = filterCategory === 'all' || d.category === filterCategory;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      d.title.toLowerCase().includes(query) ||
      (d.staffName && d.staffName.toLowerCase().includes(query)) ||
      (d.referenceNumber && d.referenceNumber.toLowerCase().includes(query)) ||
      d.content.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* HEADER BANNER */}
      <div className="no-print bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
            <FileCheck className="w-4 h-4 text-emerald-400" />
            <span>Cloud Firestore Document Hub</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <span>ឯកសារ លិខិតរដ្ឋបាល និងកំណត់ត្រាគ្រូអវត្តមាន</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl">
            គ្រប់គ្រង និងរក្សាទុកកំណត់ត្រាអវត្តមានគ្រូ លិខិតសុំច្បាប់ លិខិតបេសកកម្ម និងឯកសាររដ្ឋបាលនានាក្នុង <strong>Cloud Firestore</strong> សម្រាប់ឆ្នាំសិក្សាថ្មី។
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => openNewModal('absence_record')}
            className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-rose-950/50 cursor-pointer"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>+ កត់ត្រាអវត្តមានគ្រូ</span>
          </button>

          <button
            type="button"
            onClick={() => openNewModal('leave_request')}
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-950/50 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ បង្កើតឯកសារ/លិខិតថ្មី</span>
          </button>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="no-print bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setFilterCategory('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
              filterCategory === 'all'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            ទាំងអស់ ({documents.length})
          </button>

          {(Object.keys(CATEGORY_LABELS) as DocumentCategory[]).map((cat) => {
            const count = documents.filter((d) => d.category === cat).length;
            const config = CATEGORY_LABELS[cat];
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 flex items-center gap-1 ${
                  filterCategory === cat
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <span>{config.icon}</span>
                <span>{config.label}</span>
                <span className="text-[10px] opacity-75">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative min-w-48">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ស្វែងរកតាមចំណងជើង ឈ្មោះគ្រូ..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-hidden focus:border-amber-400"
          />
        </div>
      </div>

      {/* DOCUMENTS LIST */}
      <div className="no-print">
        {filteredDocs.length === 0 ? (
          <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl py-16 text-center text-slate-500 space-y-3">
            <FileText className="w-12 h-12 mx-auto text-slate-700" />
            <p className="text-sm font-medium">មិនមានឯកសារ ឬកំណត់ត្រាអវត្តមាននៅក្នុងជម្រើសនេះទេ</p>
            <button
              type="button"
              onClick={() => openNewModal('absence_record')}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold inline-flex items-center gap-1.5 border border-slate-700 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>កត់ត្រាអវត្តមានគ្រូ ឬបង្កើតឯកសារថ្មី</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocs.map((docItem) => {
              const catConfig = CATEGORY_LABELS[docItem.category] || CATEGORY_LABELS.other;
              const statusConfig = STATUS_LABELS[docItem.status] || STATUS_LABELS.approved;

              return (
                <div
                  key={docItem.id}
                  className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 shadow-md flex flex-col justify-between transition group"
                >
                  <div className="space-y-3">
                    {/* Category & Status badges */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${catConfig.color} flex items-center gap-1`}>
                        <span>{catConfig.icon}</span>
                        <span>{catConfig.label}</span>
                      </span>

                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${statusConfig.color}`}>
                        {statusConfig.label}
                      </span>
                    </div>

                    {/* Title */}
                    <h3
                      onClick={() => setViewingDoc(docItem)}
                      className="text-sm font-bold text-white group-hover:text-amber-300 transition cursor-pointer line-clamp-2"
                    >
                      {docItem.title}
                    </h3>

                    {/* Meta info: Staff & Date */}
                    <div className="space-y-1 text-xs text-slate-400">
                      {docItem.staffName && (
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <User className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>មន្ត្រី/គ្រូ៖ <strong>{docItem.staffName}</strong></span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>កាលបរិច្ឆេទ៖ {docItem.date}</span>
                        {docItem.referenceNumber && (
                          <span className="text-[11px] text-slate-500">• លេខ៖ {docItem.referenceNumber}</span>
                        )}
                      </div>
                    </div>

                    {/* Snippet */}
                    <p className="text-xs text-slate-400 line-clamp-3 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 leading-relaxed">
                      {docItem.content}
                    </p>

                    {/* Attachment chip */}
                    {docItem.fileAttachmentUrl && (
                      <div className="flex items-center gap-1 text-[11px] text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded-lg border border-indigo-500/20">
                        <Paperclip className="w-3 h-3 text-indigo-400" />
                        <span className="truncate">{docItem.attachmentName || 'ឯកសារភ្ជាប់/រូបភាព'}</span>
                      </div>
                    )}
                  </div>

                  {/* Action Bar */}
                  <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => setViewingDoc(docItem)}
                      className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>មើលលម្អិត</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(docItem)}
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 cursor-pointer"
                        title="កែសម្រួល"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(docItem.id)}
                        className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 cursor-pointer"
                        title="លុបចេញ"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-5 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" />
                <span>{editingDoc ? 'កែសម្រួលឯកសារ' : 'បង្កើតឯកសារ ឬកត់ត្រាអវត្តមានថ្មី'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    ប្រភេទឯកសារ / កំណត់ត្រា៖
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as DocumentCategory)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-100 focus:outline-hidden focus:border-amber-400"
                  >
                    <option value="absence_record">⚠️ កំណត់ត្រាគ្រូអវត្តមាន</option>
                    <option value="leave_request">📝 លិខិតសុំច្បាប់</option>
                    <option value="mission_letter">🚗 លិខិតបេសកកម្ម</option>
                    <option value="holiday_notice">🏖️ សេចក្តីជូនដំណឹងថ្ងៃបុណ្យ</option>
                    <option value="official_letter">📜 លិខិតរដ្ឋបាលទូទៅ</option>
                    <option value="other">📁 ឯកសារផ្សេងៗ</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    ពាក់ព័ន្ធជាមួយគ្រូ/មន្ត្រី៖
                  </label>
                  <select
                    value={staffName}
                    onChange={(e) => setStaffName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-100 focus:outline-hidden focus:border-amber-400"
                  >
                    <option value="">-- គ្មាន/រដ្ឋបាលរួម --</option>
                    {STAFF_LIST.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name} ({s.position})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  ចំណងជើងឯកសារ / កំណត់ត្រា៖
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="ឧ. កំណត់ត្រាអវត្តមានលោកគ្រូ..., លិខិតសុំច្បាប់ឈប់សម្រាកព្យាបាលជំងឺ..."
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-100 focus:outline-hidden focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    កាលបរិច្ឆេទ៖
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-100 focus:outline-hidden focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    លេខលិខិតយោង (បើមាន)៖
                  </label>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="ឧ. ០៤៥ អយក.សប"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-100 focus:outline-hidden focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    ស្ថានភាព៖
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-100 focus:outline-hidden focus:border-amber-400"
                  >
                    <option value="approved">បានអនុម័ត</option>
                    <option value="pending">រង់ចាំពិនិត្យ</option>
                    <option value="resolved">បានដោះស្រាយរួច</option>
                    <option value="archived">រក្សាទុកក្នុងបណ្ណសារ</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  ខ្លឹមសារលម្អិត / មូលហេតុ និងវិធានការដោះស្រាយ៖
                </label>
                <textarea
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="បញ្ជាក់ពីមូលហេតុនៃការអវត្តមាន រយៈពេល វិធានការដោះស្រាយ (ដូចជាគ្រូបង្រៀនជំនួស ឬវិធានការរដ្ឋបាល)..."
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-100 focus:outline-hidden focus:border-amber-400"
                />
              </div>

              {/* File upload */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  ភ្ជាប់រូបភាពលិខិត ឬឯកសារស្កេន (Optional)៖
                </label>
                <div className="flex items-center gap-3">
                  <label className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>ជ្រើសរើសឯកសារ</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>

                  {attachmentName && (
                    <span className="text-xs text-indigo-300 flex items-center gap-1 truncate max-w-xs">
                      <Paperclip className="w-3 h-3 shrink-0" />
                      <span className="truncate">{attachmentName}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setFileAttachmentUrl('');
                          setAttachmentName('');
                        }}
                        className="text-rose-400 hover:text-rose-300 ml-1"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                </div>

                {fileAttachmentUrl && fileAttachmentUrl.startsWith('data:image') && (
                  <div className="mt-2 max-h-36 max-w-xs rounded-xl overflow-hidden border border-slate-700">
                    <img src={fileAttachmentUrl} alt="Preview" className="w-full h-auto object-cover" />
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold cursor-pointer"
                >
                  បោះបង់
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុកក្នុង Firestore'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW & PRINT MODAL */}
      {viewingDoc && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${CATEGORY_LABELS[viewingDoc.category]?.color}`}>
                  {CATEGORY_LABELS[viewingDoc.category]?.label}
                </span>
                <span className="text-xs text-slate-400">កាលបរិច្ឆេទ៖ {viewingDoc.date}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>បោះពុម្ព</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewingDoc(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Official printable document view */}
            <div className="bg-white text-slate-900 rounded-xl p-6 sm:p-8 font-serif shadow-inner border border-slate-300 space-y-4 text-xs sm:text-sm leading-relaxed">
              <div className="text-center font-bold">
                <div className="text-base sm:text-lg">ព្រះរាជាណាចក្រកម្ពុជា</div>
                <div className="text-xs sm:text-sm">ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
                <div className="text-xs text-slate-400 mt-0.5">--- 🪷 ---</div>
              </div>

              <div className="text-left font-bold text-[11px] sm:text-xs text-slate-800 space-y-0.5 border-b border-slate-200 pb-2">
                <div>មន្ទីរអប់រំ យុវជន និងកីឡាខេត្តបន្ទាយមានជ័យ</div>
                <div>{SCHOOL_DISTRICT}</div>
                <div>{SCHOOL_OFFICE}</div>
                <div className="text-indigo-900 font-extrabold">{SCHOOL_NAME}</div>
                {viewingDoc.referenceNumber && <div>លេខ៖ {viewingDoc.referenceNumber}</div>}
              </div>

              <div className="text-center my-4">
                <h3 className="text-sm sm:text-base font-black text-slate-950 underline underline-offset-4 decoration-amber-600">
                  {viewingDoc.title}
                </h3>
                {viewingDoc.staffName && (
                  <div className="text-xs font-bold text-slate-700 mt-1">
                    មន្ត្រី/គ្រូបង្រៀនសាមី៖ {viewingDoc.staffName}
                  </div>
                )}
              </div>

              <div className="whitespace-pre-line text-justify text-slate-900 leading-relaxed">
                {viewingDoc.content}
              </div>

              {viewingDoc.fileAttachmentUrl && viewingDoc.fileAttachmentUrl.startsWith('data:image') && (
                <div className="pt-4 border-t border-slate-200 text-center">
                  <div className="text-xs font-bold text-slate-500 mb-2">រូបភាពឯកសារភ្ជាប់៖</div>
                  <img
                    src={viewingDoc.fileAttachmentUrl}
                    alt="Attached doc"
                    className="max-h-72 mx-auto rounded-lg border border-slate-300 shadow-sm"
                  />
                </div>
              )}

              <div className="pt-6 flex justify-between items-end text-xs font-bold">
                <div className="text-slate-600 text-[11px]">
                  <div>ស្ថានភាព៖ {STATUS_LABELS[viewingDoc.status]?.label}</div>
                  <div>កត់ត្រាដោយ៖ {viewingDoc.createdBy || 'អ្នកគ្រប់គ្រង'}</div>
                </div>

                <div className="text-center space-y-1">
                  <div className="font-normal text-slate-700">
                    ធ្វើនៅ {SCHOOL_NAME}, ថ្ងៃទី {toKhmer(viewingDoc.date.split('-')[2] || '១')} ខែ {toKhmer(viewingDoc.date.split('-')[1] || '១')} ឆ្នាំ {toKhmer(viewingDoc.date.split('-')[0] || '២០២៦')}
                  </div>
                  <div className="text-slate-950 font-black">នាយិកាសាលា</div>
                  <div className="h-16 flex items-center justify-center text-slate-400 italic font-normal text-xs">
                    [ហត្ថលេខា និងត្រា]
                  </div>
                  <div className="text-slate-950 font-bold">សុខ សារើន</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
