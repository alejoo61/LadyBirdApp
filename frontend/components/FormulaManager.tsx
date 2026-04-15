"use client";

import { useState, useEffect } from "react";
import { formulasApi } from "@/services/api/formulasApi";
import type { Formula, FormulaCreateData } from "@/services/api/formulasApi";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  CheckCircle,
  FlaskConical,
  Search,
} from "lucide-react";

const CATEGORIES = ["protein", "topping", "salsa", "snack", "tortilla", "paper"];
const TEMP_TYPES = ["hot", "cold", "dry"];
const EVENT_TYPES = ["TACO_BAR", "BIRD_BOX", "PERSONAL_BOX", "FOODA"];
const UNITS = ["oz", "oz-fl", "lb", "each", "cup", "tbsp", "tsp"];

const EMPTY_FORM: FormulaCreateData = {
  name: "",
  category: "protein",
  amountPerPerson: 0,
  unit: "oz",
  utensil: "",
  smallPackage: "",
  smallPackageMax: 0,
  largePackage: "",
  largePackageMax: null,
  tempType: "hot",
  eventTypes: ["TACO_BAR"],
  isActive: true,
};

const CATEGORY_COLORS: Record<string, string> = {
  protein: "bg-rose/20 text-rose border-rose/30",
  topping: "bg-emerald-100 text-emerald-700 border-emerald-200",
  salsa: "bg-orange-100 text-orange-600 border-orange-200",
  snack: "bg-yellow-100 text-yellow-700 border-yellow-200",
  tortilla: "bg-purple-100 text-purple-600 border-purple-200",
};

const TEMP_COLORS: Record<string, string> = {
  hot: "bg-red-100 text-red-600",
  cold: "bg-blue-100 text-blue-600",
  dry: "bg-green-100 text-green-700",
};

interface ApiError {
  response?: { data?: { error?: string } };
}

export default function FormulaManager() {
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormulaCreateData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterEventType, setFilterEventType] = useState("");

  useEffect(() => {
    loadFormulas();
  }, []);

  const loadFormulas = async () => {
    setLoading(true);
    try {
      const res = await formulasApi.getAll();
      setFormulas(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (formula: Formula) => {
    setEditingId(formula.id);
    setForm({
      name: formula.name,
      category: formula.category,
      amountPerPerson: formula.amountPerPerson,
      unit: formula.unit,
      utensil: formula.utensil,
      smallPackage: formula.smallPackage,
      smallPackageMax: formula.smallPackageMax,
      largePackage: formula.largePackage || "",
      largePackageMax: formula.largePackageMax,
      tempType: formula.tempType,
      eventTypes: formula.eventTypes,
      isActive: formula.isActive,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.category) return;
    setSaving(true);
    try {
      if (editingId) {
        await formulasApi.update(editingId, form);
        showToast("Formula updated successfully");
      } else {
        await formulasApi.create(form);
        showToast("Formula created successfully");
      }
      setShowModal(false);
      await loadFormulas();
    } catch (err: unknown) {
      const error = err as ApiError;
      showToast(`❌ ${error.response?.data?.error || "Error saving formula"}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete formula "${name}"?`)) return;
    setDeleting(id);
    try {
      await formulasApi.delete(id);
      showToast("Formula deleted");
      await loadFormulas();
    } catch (err: unknown) {
      const error = err as ApiError;
      showToast(
        `❌ ${error.response?.data?.error || "Error deleting formula"}`,
      );
    } finally {
      setDeleting(null);
    }
  };

  const toggleEventType = (et: string) => {
    setForm((f) => {
      const current = f.eventTypes || [];
      return {
        ...f,
        eventTypes: current.includes(et)
          ? current.filter((e) => e !== et)
          : [...current, et],
      };
    });
  };

  const filtered = formulas.filter((f) => {
    const matchSearch =
      !searchTerm || f.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategory = !filterCategory || f.category === filterCategory;
    const matchEventType =
      !filterEventType || f.eventTypes.includes(filterEventType);
    return matchSearch && matchCategory && matchEventType;
  });

  return (
    <div className="space-y-6 relative">
      {/* Toast */}
      {toast && (
        <div className="fixed top-10 right-10 z-[100] bg-night text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center space-x-3">
          <CheckCircle className="text-rose" size={20} />
          <span className="font-black text-xs uppercase tracking-widest">
            {toast}
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-night tracking-tight uppercase italic">
            Ingredient Formulas
          </h2>
          <p className="text-sm text-night/50 font-medium">
            {filtered.length} formulas
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-5 py-3 bg-night text-bone rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-rose hover:text-white transition-all"
        >
          <Plus size={16} />
          New Formula
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-tumbleweed space-y-3">
        <div className="relative">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-night/30"
            size={18}
          />
          <input
            type="text"
            placeholder="Search formulas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-bone border-none rounded-2xl focus:ring-2 focus:ring-night text-sm font-bold text-night outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 bg-bone rounded-xl text-[11px] font-black uppercase tracking-widest text-night/60 border-none outline-none cursor-pointer"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={filterEventType}
            onChange={(e) => setFilterEventType(e.target.value)}
            className="px-4 py-2 bg-bone rounded-xl text-[11px] font-black uppercase tracking-widest text-night/60 border-none outline-none cursor-pointer"
          >
            <option value="">All Event Types</option>
            {EVENT_TYPES.map((et) => (
              <option key={et} value={et}>
                {et}
              </option>
            ))}
          </select>
          {(filterCategory || filterEventType || searchTerm) && (
            <button
              onClick={() => {
                setFilterCategory("");
                setFilterEventType("");
                setSearchTerm("");
              }}
              className="px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest bg-rose/10 text-rose hover:bg-rose hover:text-white transition-all"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20 text-night animate-pulse font-black uppercase tracking-widest">
          Loading...
        </div>
      ) : (
        <div className="bg-white rounded-[2rem] border border-tumbleweed/30 overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-tumbleweed/20 bg-bone">
                <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-widest text-night/40">
                  Name
                </th>
                <th className="text-left px-4 py-4 text-[10px] font-black uppercase tracking-widest text-night/40">
                  Category
                </th>
                <th className="text-left px-4 py-4 text-[10px] font-black uppercase tracking-widest text-night/40">
                  Amt/Person
                </th>
                <th className="text-left px-4 py-4 text-[10px] font-black uppercase tracking-widest text-night/40">
                  Packaging
                </th>
                <th className="text-left px-4 py-4 text-[10px] font-black uppercase tracking-widest text-night/40">
                  Temp
                </th>
                <th className="text-left px-4 py-4 text-[10px] font-black uppercase tracking-widest text-night/40">
                  Event Types
                </th>
                <th className="text-left px-4 py-4 text-[10px] font-black uppercase tracking-widest text-night/40">
                  Active
                </th>
                <th className="px-4 py-4"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((formula, idx) => (
                <tr
                  key={formula.id}
                  className={`border-b border-tumbleweed/10 last:border-0 hover:bg-bone/50 transition-colors ${idx % 2 === 0 ? "" : "bg-bone/20"}`}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <FlaskConical
                        size={14}
                        className="text-night/30 shrink-0"
                      />
                      <span className="font-black text-night text-sm">
                        {formula.name}
                      </span>
                    </div>
                    {formula.utensil && (
                      <p className="text-[10px] text-night/30 ml-6 mt-0.5">
                        {formula.utensil}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full border ${CATEGORY_COLORS[formula.category] || "bg-gray-100 text-gray-600 border-gray-200"}`}
                    >
                      {formula.category}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="font-black text-night text-sm">
                      {formula.amountPerPerson}
                    </span>
                    <span className="text-[10px] text-night/40 ml-1">
                      {formula.unit}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-[11px] text-night/60">
                    <div>
                      S: {formula.smallPackage} (max {formula.smallPackageMax})
                    </div>
                    {formula.largePackage && (
                      <div className="text-night/40">
                        L: {formula.largePackage} (max {formula.largePackageMax}
                        )
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ${TEMP_COLORS[formula.tempType] || ""}`}
                    >
                      {formula.tempType}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-1">
                      {formula.eventTypes.map((et) => (
                        <span
                          key={et}
                          className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-night/10 text-night/50"
                        >
                          {et.replace("_", " ")}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ${formula.isActive ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-400"}`}
                    >
                      {formula.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEdit(formula)}
                        className="p-2 text-night/30 hover:text-night hover:bg-bone rounded-lg transition-all"
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="flex flex-col items-center py-16 text-night/30">
              <FlaskConical size={40} className="mb-3" />
              <p className="font-black uppercase tracking-widest text-sm">
                No formulas found
              </p>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-night/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-8 pb-4 shrink-0">
              <h3 className="text-xl font-black text-night uppercase italic tracking-tight">
                {editingId ? "Edit Formula" : "New Formula"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-night/30 hover:text-rose transition-colors rounded-xl hover:bg-rose/10"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto px-8 pb-4 space-y-5 flex-1">
              {/* Name */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-night/40 mb-1 block">
                  Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="w-full px-4 py-3 bg-bone rounded-2xl text-sm font-bold text-night outline-none focus:ring-2 focus:ring-night"
                  placeholder="e.g. Salsa Verde Braised Chicken"
                />
              </div>

              {/* Category + Temp Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-night/40 mb-1 block">
                    Category *
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, category: e.target.value }))
                    }
                    className="w-full px-4 py-3 bg-bone rounded-2xl text-sm font-bold text-night outline-none focus:ring-2 focus:ring-night cursor-pointer"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-night/40 mb-1 block">
                    Temp Type *
                  </label>
                  <select
                    value={form.tempType}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, tempType: e.target.value }))
                    }
                    className="w-full px-4 py-3 bg-bone rounded-2xl text-sm font-bold text-night outline-none focus:ring-2 focus:ring-night cursor-pointer"
                  >
                    {TEMP_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Amount + Unit + Utensil */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-night/40 mb-1 block">
                    Amt / Person *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.amountPerPerson}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        amountPerPerson: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-full px-4 py-3 bg-bone rounded-2xl text-sm font-bold text-night outline-none focus:ring-2 focus:ring-night"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-night/40 mb-1 block">
                    Unit *
                  </label>
                  <select
                    value={form.unit}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, unit: e.target.value }))
                    }
                    className="w-full px-4 py-3 bg-bone rounded-2xl text-sm font-bold text-night outline-none focus:ring-2 focus:ring-night cursor-pointer"
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-night/40 mb-1 block">
                    Utensil
                  </label>
                  <input
                    type="text"
                    value={form.utensil}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, utensil: e.target.value }))
                    }
                    className="w-full px-4 py-3 bg-bone rounded-2xl text-sm font-bold text-night outline-none focus:ring-2 focus:ring-night"
                    placeholder="e.g. Tongs Small"
                  />
                </div>
              </div>

              {/* Small Package */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-night/40 mb-1 block">
                    Small Package
                  </label>
                  <input
                    type="text"
                    value={form.smallPackage}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, smallPackage: e.target.value }))
                    }
                    className="w-full px-4 py-3 bg-bone rounded-2xl text-sm font-bold text-night outline-none focus:ring-2 focus:ring-night"
                    placeholder="e.g. Half Pan"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-night/40 mb-1 block">
                    Small Package Max
                  </label>
                  <input
                    type="number"
                    value={form.smallPackageMax}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        smallPackageMax: parseInt(e.target.value) || 0,
                      }))
                    }
                    className="w-full px-4 py-3 bg-bone rounded-2xl text-sm font-bold text-night outline-none focus:ring-2 focus:ring-night"
                  />
                </div>
              </div>

              {/* Large Package */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-night/40 mb-1 block">
                    Large Package
                  </label>
                  <input
                    type="text"
                    value={form.largePackage || ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, largePackage: e.target.value }))
                    }
                    className="w-full px-4 py-3 bg-bone rounded-2xl text-sm font-bold text-night outline-none focus:ring-2 focus:ring-night"
                    placeholder="e.g. Full Pan"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-night/40 mb-1 block">
                    Large Package Max
                  </label>
                  <input
                    type="number"
                    value={form.largePackageMax || ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        largePackageMax: parseInt(e.target.value) || null,
                      }))
                    }
                    className="w-full px-4 py-3 bg-bone rounded-2xl text-sm font-bold text-night outline-none focus:ring-2 focus:ring-night"
                    placeholder="Optional"
                  />
                </div>
              </div>

              {/* Event Types */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-night/40 mb-2 block">
                  Event Types *
                </label>
                <div className="flex flex-wrap gap-2">
                  {EVENT_TYPES.map((et) => (
                    <button
                      key={et}
                      type="button"
                      onClick={() => toggleEventType(et)}
                      className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                        (form.eventTypes || []).includes(et)
                          ? "bg-night text-bone"
                          : "bg-bone text-night/40 hover:text-night"
                      }`}
                    >
                      {et.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({ ...f, isActive: !f.isActive }))
                  }
                  className={`w-12 h-6 rounded-full transition-all relative ${form.isActive ? "bg-emerald-500" : "bg-night/20"}`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${form.isActive ? "left-6" : "left-0.5"}`}
                  />
                </button>
                <span className="text-[11px] font-black uppercase tracking-widest text-night/60">
                  {form.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-8 pt-4 flex gap-3 justify-end shrink-0 border-t border-tumbleweed/20">
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-bone text-night/40 hover:text-night transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name}
                className="px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-night text-bone hover:bg-rose hover:text-white transition-all disabled:opacity-40"
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update Formula"
                    : "Create Formula"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
