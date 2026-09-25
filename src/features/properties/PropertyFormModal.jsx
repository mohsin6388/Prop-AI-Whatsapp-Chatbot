import { useState } from 'react';
import { X } from 'lucide-react';
import { propertyApi } from '../../api/propertyApi.js';

const PROPERTY_TYPES = ['Apartment', 'Villa', 'Plot', 'Commercial', 'Studio', 'Penthouse'];

const EMPTY_FORM = {
  projectName: '', builderName: '', propertyType: 'Apartment', bhk: '',
  location: '', city: '', budgetMin: '', budgetMax: '', sizeSqft: '',
  amenitiesText: '', parking: false, reraNumber: '',
  nearbyMetro: '', nearbySchool: '', nearbyHospital: '', mapsLink: '',
  description: '', imagesText: '', isActive: true,
};

export default function PropertyFormModal({ property, onClose, onSaved }) {
  const isEdit = Boolean(property);
  const [form, setForm] = useState(() =>
    isEdit
      ? {
          projectName: property.projectName || '', builderName: property.builderName || '',
          propertyType: property.propertyType || 'Apartment', bhk: property.bhk || '',
          location: property.location || '', city: property.city || '',
          budgetMin: property.budgetMin ?? '', budgetMax: property.budgetMax ?? '',
          sizeSqft: property.sizeSqft ?? '',
          amenitiesText: (property.amenities || []).join(', '),
          parking: property.parking || false, reraNumber: property.reraNumber || '',
          nearbyMetro: property.nearbyMetro || '', nearbySchool: property.nearbySchool || '',
          nearbyHospital: property.nearbyHospital || '', mapsLink: property.mapsLink || '',
          description: property.description || '',
          imagesText: (property.images || []).join(', '),
          isActive: property.isActive ?? true,
        }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        projectName: form.projectName,
        builderName: form.builderName,
        propertyType: form.propertyType,
        bhk: form.bhk,
        location: form.location,
        city: form.city,
        budgetMin: form.budgetMin === '' ? null : Number(form.budgetMin),
        budgetMax: form.budgetMax === '' ? null : Number(form.budgetMax),
        sizeSqft: form.sizeSqft === '' ? null : Number(form.sizeSqft),
        amenities: form.amenitiesText.split(',').map((s) => s.trim()).filter(Boolean),
        parking: form.parking,
        reraNumber: form.reraNumber,
        nearbyMetro: form.nearbyMetro,
        nearbySchool: form.nearbySchool,
        nearbyHospital: form.nearbyHospital,
        mapsLink: form.mapsLink,
        description: form.description,
        images: form.imagesText.split(',').map((s) => s.trim()).filter(Boolean),
        isActive: form.isActive,
      };
      if (isEdit) {
        await propertyApi.update(property._id, payload);
      } else {
        await propertyApi.create(payload);
      }
      onSaved();
    } catch (err) {
      setError(err?.response?.data?.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-6 dark:bg-ink-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-ink-900 dark:text-white">
            {isEdit ? 'Edit Property' : 'Add Property'}
          </h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700 dark:hover:text-white">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="Project Name *" value={form.projectName} onChange={set('projectName')} required />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Builder Name" value={form.builderName} onChange={set('builderName')} />
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-500 dark:text-ink-400">Property Type</label>
              <select value={form.propertyType} onChange={set('propertyType')} className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-800 dark:text-white">
                {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="BHK" placeholder='e.g. "2", "2-3", "Studio"' value={form.bhk} onChange={set('bhk')} />
            <Field label="Size (sqft)" type="number" value={form.sizeSqft} onChange={set('sizeSqft')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="City" value={form.city} onChange={set('city')} />
            <Field label="Location" value={form.location} onChange={set('location')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Budget Min" type="number" value={form.budgetMin} onChange={set('budgetMin')} />
            <Field label="Budget Max" type="number" value={form.budgetMax} onChange={set('budgetMax')} />
          </div>

          <Field label="Amenities (comma separated)" placeholder="Gym, Pool, Clubhouse" value={form.amenitiesText} onChange={set('amenitiesText')} />

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-ink-700 dark:text-ink-200">
              <input type="checkbox" checked={form.parking} onChange={set('parking')} />
              Parking available
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-700 dark:text-ink-200">
              <input type="checkbox" checked={form.isActive} onChange={set('isActive')} />
              Active listing
            </label>
          </div>

          <Field label="RERA Number" value={form.reraNumber} onChange={set('reraNumber')} />

          <div className="grid grid-cols-3 gap-3">
            <Field label="Nearby Metro" value={form.nearbyMetro} onChange={set('nearbyMetro')} />
            <Field label="Nearby School" value={form.nearbySchool} onChange={set('nearbySchool')} />
            <Field label="Nearby Hospital" value={form.nearbyHospital} onChange={set('nearbyHospital')} />
          </div>

          <Field label="Google Maps Link" value={form.mapsLink} onChange={set('mapsLink')} />
          <Field label="Image URLs (comma separated)" value={form.imagesText} onChange={set('imagesText')} />
          <TextArea label="Description" value={form.description} onChange={set('description')} />

          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              {saving ? 'Saving...' : isEdit ? 'Update Property' : 'Add Property'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, ...props }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-ink-500 dark:text-ink-400">{label}</label>
      <input
        {...props}
        className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-800 dark:text-white"
      />
    </div>
  );
}

function TextArea({ label, ...props }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-ink-500 dark:text-ink-400">{label}</label>
      <textarea
        rows={3}
        {...props}
        className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-800 dark:text-white"
      />
    </div>
  );
}