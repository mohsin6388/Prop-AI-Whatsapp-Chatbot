import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Trash2, Pencil, Download, Upload, MapPin, Home, Car } from 'lucide-react';
import { propertyApi } from '../../api/propertyApi.js';
import PropertyFormModal from './PropertyFormModal.jsx';
import ImportPropertiesModal from './ImportPropertiesModal.jsx';

export default function PropertiesPage() {
  const [properties, setProperties] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);
  const [showImport, setShowImport] = useState(false);

  const fetchProperties = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await propertyApi.list({
        page, limit: 20,
        ...(search ? { search } : {}),
        ...(city ? { city } : {}),
      });
      setProperties(res.data.properties);
      setPagination(res.data.pagination);
    } finally {
      setLoading(false);
    }
  }, [search, city]);

  useEffect(() => { fetchProperties(1); }, [fetchProperties]);

  const toggleSelect = (id) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this property?')) return;
    await propertyApi.remove(id);
    fetchProperties(pagination.page);
  };

  const handleBulkDelete = async () => {
    if (!selected.length || !confirm(`Delete ${selected.length} properties?`)) return;
    await propertyApi.bulkDelete(selected);
    setSelected([]);
    fetchProperties(1);
  };

  const formatBudget = (min, max) => {
    if (!min && !max) return 'Budget not set';
    const fmt = (n) => (n >= 10000000 ? `₹${(n / 10000000).toFixed(1)}Cr` : n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${n}`);
    return `${fmt(min || 0)} - ${fmt(max || 0)}`;
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white">Properties</h1>
        <div className="flex gap-2">
          <a href={propertyApi.exportUrl()} className="flex items-center gap-2 rounded-lg border border-ink-200 px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-100 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800">
            <Download size={16} /> Export
          </a>
          <button onClick={() => setShowImport(true)} className="flex items-center gap-2 rounded-lg border border-ink-200 px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-100 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800">
            <Upload size={16} /> Import CSV
          </button>
          <button onClick={() => { setEditingProperty(null); setShowForm(true); }} className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
            <Plus size={16} /> Add Property
          </button>
        </div>
      </div>

      <div className="card mt-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search project, location, description..."
            className="w-full rounded-lg border border-ink-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-ink-700 dark:bg-ink-800 dark:text-white"
          />
        </div>
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Filter by city"
          className="w-40 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-800 dark:text-white"
        />
        {selected.length > 0 && (
          <button onClick={handleBulkDelete} className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700">
            <Trash2 size={16} /> Delete {selected.length}
          </button>
        )}
      </div>

      {loading ? (
        <div className="card mt-4 py-16 text-center text-ink-400">Loading...</div>
      ) : properties.length === 0 ? (
        <div className="card mt-4 py-16 text-center text-ink-400">
          No properties yet. Add one to get started.
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => (
            <div key={p._id} className="card relative overflow-hidden p-0">
              <div className="relative h-40 w-full bg-ink-100 dark:bg-ink-800">
                {p.images?.[0] ? (
                  <img src={p.images[0]} alt={p.projectName} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-ink-300">
                    <Home size={32} />
                  </div>
                )}
                <input
                  type="checkbox"
                  checked={selected.includes(p._id)}
                  onChange={() => toggleSelect(p._id)}
                  className="absolute left-2 top-2 h-4 w-4"
                />
                {!p.isActive && (
                  <span className="absolute right-2 top-2 rounded-full bg-gray-800/80 px-2 py-0.5 text-xs font-medium text-white">
                    Inactive
                  </span>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <h3 className="font-display text-base font-semibold text-ink-900 dark:text-white">{p.projectName}</h3>
                  {p.bhk && (
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-200">
                      {p.bhk} BHK
                    </span>
                  )}
                </div>
                {p.location && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-ink-500 dark:text-ink-400">
                    <MapPin size={12} /> {p.location}{p.city ? `, ${p.city}` : ''}
                  </p>
                )}
                <p className="mt-2 text-sm font-medium text-ink-700 dark:text-ink-200">
                  {formatBudget(p.budgetMin, p.budgetMax)}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.propertyType && (
                    <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-600 dark:bg-ink-800 dark:text-ink-300">{p.propertyType}</span>
                  )}
                  {p.parking && (
                    <span className="flex items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-600 dark:bg-ink-800 dark:text-ink-300">
                      <Car size={10} /> Parking
                    </span>
                  )}
                  {(p.amenities || []).slice(0, 2).map((a) => (
                    <span key={a} className="rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-600 dark:bg-ink-800 dark:text-ink-300">{a}</span>
                  ))}
                </div>

                <div className="mt-3 flex justify-end gap-2 border-t border-ink-100 pt-3 dark:border-ink-800">
                  <button onClick={() => { setEditingProperty(p); setShowForm(true); }} className="text-ink-400 hover:text-brand-600">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => handleDelete(p._id)} className="text-ink-400 hover:text-red-600">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            disabled={pagination.page <= 1}
            onClick={() => fetchProperties(pagination.page - 1)}
            className="rounded-lg border border-ink-200 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-ink-700"
          >
            Prev
          </button>
          <span className="text-sm text-ink-500 dark:text-ink-400">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => fetchProperties(pagination.page + 1)}
            className="rounded-lg border border-ink-200 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-ink-700"
          >
            Next
          </button>
        </div>
      )}

      {showForm && (
        <PropertyFormModal
          property={editingProperty}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchProperties(pagination.page); }}
        />
      )}

      {showImport && (
        <ImportPropertiesModal
          onClose={() => setShowImport(false)}
          onImported={() => fetchProperties(1)}
        />
      )}
    </div>
  );
}