import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Search,
  Trash2,
  Pencil,
  Download,
  Upload,
  MapPin,
  Home,
  Car,
  X,
  FileText,
  ImagePlus,
  Loader2,
} from "lucide-react";

import { propertyApi } from "../../api/propertyApi.js";
import PropertyFormModal from "./PropertyFormModal.jsx";
import ImportPropertiesModal from "./ImportPropertiesModal.jsx";

export default function PropertiesPage() {
  const [properties, setProperties] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [selected, setSelected] = useState([]);

  const [loading, setLoading] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);

  const [showImport, setShowImport] = useState(false);

  // ==========================================
  // BROCHURE UPLOAD STATE
  // ==========================================

  const [showBrochureUpload, setShowBrochureUpload] = useState(false);

  const [brochureFile, setBrochureFile] = useState(null);

  const [propertyImages, setPropertyImages] = useState([]);

  const [uploadingBrochure, setUploadingBrochure] = useState(false);

  const [brochureError, setBrochureError] = useState("");

  // ==========================================
  // FETCH PROPERTIES
  // ==========================================

  const fetchProperties = useCallback(
    async (page = 1) => {
      setLoading(true);

      try {
        const res = await propertyApi.list({
          page,
          limit: 20,
          ...(search ? { search } : {}),
          ...(city ? { city } : {}),
        });

        setProperties(res.data.properties);
        setPagination(res.data.pagination);
      } finally {
        setLoading(false);
      }
    },
    [search, city],
  );

  useEffect(() => {
    fetchProperties(1);
  }, [fetchProperties]);

  // ==========================================
  // SELECT PROPERTY
  // ==========================================

  const toggleSelect = (id) => {
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );
  };

  // ==========================================
  // DELETE PROPERTY
  // ==========================================

  const handleDelete = async (id) => {
    if (!confirm("Delete this property?")) return;

    await propertyApi.remove(id);

    fetchProperties(pagination.page);
  };

  // ==========================================
  // BULK DELETE
  // ==========================================

  const handleBulkDelete = async () => {
    if (!selected.length || !confirm(`Delete ${selected.length} properties?`)) {
      return;
    }

    await propertyApi.bulkDelete(selected);

    setSelected([]);

    fetchProperties(1);
  };

  // ==========================================
  // FORMAT BUDGET
  // ==========================================

  const formatBudget = (min, max) => {
    if (!min && !max) return "Budget not set";

    const fmt = (n) =>
      n >= 10000000
        ? `₹${(n / 10000000).toFixed(1)}Cr`
        : n >= 100000
          ? `₹${(n / 100000).toFixed(1)}L`
          : `₹${n}`;

    return `${fmt(min || 0)} - ${fmt(max || 0)}`;
  };

  // ==========================================
  // BROCHURE MODAL OPEN
  // ==========================================

  const openBrochureUpload = () => {
    setBrochureFile(null);
    setPropertyImages([]);
    setBrochureError("");
    setShowBrochureUpload(true);
  };

  // ==========================================
  // BROCHURE MODAL CLOSE
  // ==========================================

  const closeBrochureUpload = () => {
    if (uploadingBrochure) return;

    setShowBrochureUpload(false);
    setBrochureFile(null);
    setPropertyImages([]);
    setBrochureError("");
  };

  // ==========================================
  // BROCHURE FILE SELECT
  // ==========================================

  const handleBrochureChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const MAX_BROCHURE_SIZE = 10 * 1024 * 1024; // 10 MB

    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      setBrochureError("Please select a valid PDF brochure.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_BROCHURE_SIZE) {
      setBrochureError("Brochure PDF must be 10 MB or smaller.");
      event.target.value = "";
      return;
    }

    setBrochureError("");
    setBrochureFile(file);
  };

  // ==========================================
  // PROPERTY IMAGES SELECT
  // ==========================================

  const handleImagesChange = (event) => {
    const files = Array.from(event.target.files || []);

    if (!files.length) return;

    const MAX_IMAGES = 10;
    const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

    if (files.length > MAX_IMAGES) {
      setBrochureError("You can upload maximum 10 property images.");
      event.target.value = "";
      return;
    }

    const allowedImageTypes = ["image/jpeg", "image/jpg", "image/png"];

    const invalidImage = files.find(
      (file) => !allowedImageTypes.includes(file.type),
    );

    if (invalidImage) {
      setBrochureError(
        `${invalidImage.name} is not supported. Only JPG, JPEG and PNG images are allowed.`,
      );
      event.target.value = "";
      return;
    }

    const oversizedImage = files.find((file) => file.size > MAX_IMAGE_SIZE);

    if (oversizedImage) {
      setBrochureError(
        `${oversizedImage.name} is too large. Each image must be 5 MB or smaller.`,
      );
      event.target.value = "";
      return;
    }

    setBrochureError("");
    setPropertyImages(files);
  };

  // ==========================================
  // UPLOAD BROCHURE + IMAGES
  // ==========================================

  const handleBrochureUpload = async () => {
    if (!brochureFile && propertyImages.length === 0) {
      setBrochureError(
        "Please select a brochure PDF or at least one property image.",
      );

      return;
    }

    setBrochureError("");
    setUploadingBrochure(true);

    try {
      await propertyApi.uploadBrochure({
        brochure: brochureFile,
        images: propertyImages,
      });

      setShowBrochureUpload(false);

      setBrochureFile(null);
      setPropertyImages([]);

      await fetchProperties(1);
    } catch (error) {
      console.error("Brochure upload failed:", error);

      setBrochureError(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          "Failed to upload brochure. Please try again.",
      );
    } finally {
      setUploadingBrochure(false);
    }
  };

  return (
    <div>
      {/* ======================================
          HEADER
      ====================================== */}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white">
          Properties
        </h1>

        <div className="flex flex-wrap gap-2">
          <a
            href={propertyApi.exportUrl()}
            className="flex items-center gap-2 rounded-lg border border-ink-200 px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-100 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
          >
            <Download size={16} />
            Export
          </a>

          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 rounded-lg border border-ink-200 px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-100 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
          >
            <Upload size={16} />
            Import CSV
          </button>

          {/* ==================================
              NEW BROCHURE BUTTON
          ================================== */}

          <button
            onClick={openBrochureUpload}
            className="flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 dark:border-brand-900/40 dark:bg-brand-900/20 dark:text-brand-200"
          >
            <FileText size={16} />
            Add Brochure
          </button>

          <button
            onClick={() => {
              setEditingProperty(null);
              setShowForm(true);
            }}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus size={16} />
            Add Property
          </button>
        </div>
      </div>

      {/* ======================================
          SEARCH / FILTERS
      ====================================== */}

      <div className="card mt-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
          />

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
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            <Trash2 size={16} />
            Delete {selected.length}
          </button>
        )}
      </div>

      {/* ======================================
          PROPERTY LIST
      ====================================== */}

      {loading ? (
        <div className="card mt-4 py-16 text-center text-ink-400">
          Loading...
        </div>
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
                  <img
                    src={p.images[0]}
                    alt={p.projectName}
                    className="h-full w-full object-cover"
                  />
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
                  <h3 className="font-display text-base font-semibold text-ink-900 dark:text-white">
                    {p.projectName || "Property"}
                  </h3>

                  {p.bhk && (
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-200">
                      {p.bhk} BHK
                    </span>
                  )}
                </div>

                {p.location && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-ink-500 dark:text-ink-400">
                    <MapPin size={12} />
                    {p.location}
                    {p.city ? `, ${p.city}` : ""}
                  </p>
                )}

                <p className="mt-2 text-sm font-medium text-ink-700 dark:text-ink-200">
                  {formatBudget(p.budgetMin, p.budgetMax)}
                </p>

                <div className="mt-2 flex flex-wrap gap-1">
                  {p.propertyType && (
                    <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-600 dark:bg-ink-800 dark:text-ink-300">
                      {p.propertyType}
                    </span>
                  )}

                  {p.parking && (
                    <span className="flex items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-600 dark:bg-ink-800 dark:text-ink-300">
                      <Car size={10} />
                      Parking
                    </span>
                  )}

                  {(p.amenities || []).slice(0, 2).map((a) => (
                    <span
                      key={a}
                      className="rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-600 dark:bg-ink-800 dark:text-ink-300"
                    >
                      {a}
                    </span>
                  ))}
                </div>

                <div className="mt-3 flex justify-end gap-2 border-t border-ink-100 pt-3 dark:border-ink-800">
                  <button
                    onClick={() => {
                      setEditingProperty(p);
                      setShowForm(true);
                    }}
                    className="text-ink-400 hover:text-brand-600"
                  >
                    <Pencil size={16} />
                  </button>

                  <button
                    onClick={() => handleDelete(p._id)}
                    className="text-ink-400 hover:text-red-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ======================================
          PAGINATION
      ====================================== */}

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

      {/* ======================================
          PROPERTY FORM
      ====================================== */}

      {showForm && (
        <PropertyFormModal
          property={editingProperty}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            fetchProperties(pagination.page);
          }}
        />
      )}

      {/* ======================================
          CSV IMPORT
      ====================================== */}

      {showImport && (
        <ImportPropertiesModal
          onClose={() => setShowImport(false)}
          onImported={() => fetchProperties(1)}
        />
      )}

      {/* ======================================
          BROCHURE UPLOAD MODAL
      ====================================== */}

      {showBrochureUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl dark:bg-ink-900">
            {/* MODAL HEADER */}

            <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4 dark:border-ink-800">
              <div>
                <h2 className="text-lg font-semibold text-ink-900 dark:text-white">
                  Add Property Brochure
                </h2>

                <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
                  Upload brochure and property images. Property details will be
                  extracted automatically.
                </p>
              </div>

              <button
                onClick={closeBrochureUpload}
                disabled={uploadingBrochure}
                className="rounded-lg p-2 text-ink-400 hover:bg-ink-100 hover:text-ink-700 disabled:opacity-40 dark:hover:bg-ink-800"
              >
                <X size={18} />
              </button>
            </div>

            {/* MODAL BODY */}

            <div className="space-y-5 p-5">
              {/* BROCHURE */}

              <div>
                <label className="mb-2 block text-sm font-medium text-ink-800 dark:text-ink-200">
                  Brochure PDF
                </label>

                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-ink-300 p-4 hover:border-brand-500 hover:bg-brand-50/50 dark:border-ink-700 dark:hover:bg-brand-900/10">
                  <div className="rounded-lg bg-red-100 p-2 text-red-600 dark:bg-red-900/20 dark:text-red-300">
                    <FileText size={22} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink-800 dark:text-white">
                      {brochureFile ? brochureFile.name : "Choose brochure PDF"}
                    </p>

                    <p className="mt-1 text-xs text-ink-400">
                      PDF only, maximum 10 MB
                    </p>
                  </div>

                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={handleBrochureChange}
                    className="hidden"
                    disabled={uploadingBrochure}
                  />
                </label>
              </div>

              {/* IMAGES */}

              <div>
                <label className="mb-2 block text-sm font-medium text-ink-800 dark:text-ink-200">
                  Property Images
                </label>

                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-ink-300 p-4 hover:border-brand-500 hover:bg-brand-50/50 dark:border-ink-700 dark:hover:bg-brand-900/10">
                  <div className="rounded-lg bg-brand-100 p-2 text-brand-600 dark:bg-brand-900/20 dark:text-brand-300">
                    <ImagePlus size={22} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink-800 dark:text-white">
                      {propertyImages.length
                        ? `${propertyImages.length} image(s) selected`
                        : "Choose property images"}
                    </p>

                    <p className="mt-1 text-xs text-ink-400">
                      JPG, JPEG, PNG • Maximum 10 images • 5 MB each
                    </p>
                  </div>

                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png"
                    multiple
                    onChange={handleImagesChange}
                    className="hidden"
                    disabled={uploadingBrochure}
                  />
                </label>

                {propertyImages.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {propertyImages.map((file, index) => (
                      <div
                        key={`${file.name}-${index}`}
                        className="flex items-center gap-2 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600 dark:bg-ink-800 dark:text-ink-300"
                      >
                        <ImagePlus size={13} />

                        <span className="truncate">{file.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ERROR */}

              {brochureError && (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-300">
                  {brochureError}
                </div>
              )}

              {/* PROCESSING MESSAGE */}

              {uploadingBrochure && (
                <div className="flex items-center gap-3 rounded-lg bg-brand-50 px-3 py-3 text-sm text-brand-700 dark:bg-brand-900/20 dark:text-brand-200">
                  <Loader2 size={18} className="animate-spin" />

                  <div>
                    <p className="font-medium">Processing property...</p>

                    <p className="text-xs opacity-80">
                      Uploading files and extracting property details with AI.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* MODAL FOOTER */}

            <div className="flex justify-end gap-2 border-t border-ink-100 px-5 py-4 dark:border-ink-800">
              <button
                onClick={closeBrochureUpload}
                disabled={uploadingBrochure}
                className="rounded-lg border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-100 disabled:opacity-40 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
              >
                Cancel
              </button>

              <button
                onClick={handleBrochureUpload}
                disabled={uploadingBrochure}
                className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploadingBrochure && (
                  <Loader2 size={16} className="animate-spin" />
                )}

                {uploadingBrochure ? "Processing..." : "Upload & Process"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
