(async function hydrateSinopWorkspace() {
  const STATE_KEY = "sinop-dmw-workspace-state-v1";
  const THEME_KEY = "sinop-tenant-theme";

  const text = (value) => value == null ? "" : String(value);
  const number = (value) => Number(value || 0);
  const byId = (rows) => new Map((rows || []).map((row) => [row.id, row]));
  const dateLabel = (value) => {
    if (!value) return "";
    const parsed = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? text(value) : parsed.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" });
  };
  const itemName = (item) => {
    if (!item) return "Unnamed item";
    return item.description && item.description !== item.item_name ? `${item.item_name} — ${item.description}` : item.item_name;
  };
  const parseJson = (value) => {
    try { return typeof value === "string" ? JSON.parse(value || "{}") : (value || {}); } catch { return {}; }
  };
  const contrastText = (hex) => {
    const value = String(hex || "").replace("#", "");
    if (!/^[0-9a-f]{6}$/i.test(value)) return "#ffffff";
    const [r, g, b] = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255).map((channel) => channel <= .03928 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
    return .2126 * r + .7152 * g + .0722 * b > .48 ? "#10232f" : "#ffffff";
  };

  function applyTheme() {
    const fallback = { agencyName: "Sinop Demo Agency", agencyAddress: "", colors: ["#0F2942", "#059669"], formula: "FIFO" };
    const theme = { ...fallback, ...parseJson(localStorage.getItem(THEME_KEY)) };
    const colors = Array.isArray(theme.colors) && theme.colors.length >= 2 ? theme.colors.slice(0, 3) : fallback.colors;
    const primary = colors[0]; const accent = colors[1]; const tertiary = colors[2] || accent;
    document.body.classList.add("tenant-themed");
    window.stockCardEntityName = theme.agencyName || fallback.agencyName;
    document.documentElement.style.setProperty("--navy", primary);
    document.documentElement.style.setProperty("--blue", primary);
    document.documentElement.style.setProperty("--teal", accent);
    document.documentElement.style.setProperty("--green", accent);
    document.documentElement.style.setProperty("--tenant-primary", primary);
    document.documentElement.style.setProperty("--tenant-accent", accent);
    document.documentElement.style.setProperty("--tenant-tertiary", tertiary);
    document.documentElement.style.setProperty("--tenant-third", tertiary);
    document.documentElement.style.setProperty("--tenant-primary-text", contrastText(primary));
    document.documentElement.style.setProperty("--tenant-accent-text", contrastText(accent));
    document.documentElement.style.setProperty("--tenant-tertiary-text", contrastText(tertiary));
    document.documentElement.style.setProperty("--tenant-soft", `color-mix(in srgb, ${accent} 11%, #ffffff)`);
    document.querySelectorAll("[data-agency-name]").forEach((node) => { node.textContent = window.stockCardEntityName; });
    document.querySelectorAll(".agency-brand-mark").forEach((node) => {
      node.innerHTML = theme.logoPreview ? `<img src="${theme.logoPreview}" alt="${window.stockCardEntityName} logo">` : "S";
      node.style.background = theme.logoPreview ? "#ffffff" : `linear-gradient(145deg, ${primary}, ${accent})`;
    });
    document.querySelectorAll("img[src='/agency-header-placeholder.png']").forEach((image) => {
      if (theme.headerPreview) image.src = theme.headerPreview;
      else image.style.display = "none";
    });
  }
  window.applySinopTenantTheme = applyTheme;

  function applyState(state) {
    pos = state.pos || [];
    iars = state.iars || [];
    risRecords = state.risRecords || [];
    propertyUnits = state.propertyUnits || [];
    rsmiRecords = state.rsmiRecords || [];
    Object.keys(masters).forEach((key) => { masters[key] = state.masters?.[key] || []; });
    window.risAvailableBatches = state.risAvailableBatches || [];
    window.inventoryEmployeeAccounts = state.employeeAccounts || [];
  }

  function mapTransfer(bundle) {
    const data = bundle.data || {};
    const offices = byId(data.offices);
    const suppliers = byId(data.suppliers);
    const uacs = byId(data.uacs_accounts);
    const categories = byId(data.item_categories);
    const employees = byId(data.employees);
    const items = byId(data.items);
    const poRows = byId(data.purchase_orders);
    const poItems = data.purchase_order_items || [];
    const iarRows = byId(data.inspection_acceptance_reports);
    const iarItems = data.inspection_acceptance_items || [];
    const batches = data.inventory_batches || [];
    const risRows = data.requisition_issue_slips || [];
    const risItems = data.requisition_issue_slip_items || [];
    const allocations = data.ris_batch_allocations || [];
    const settings = data.system_settings || [];

    const sortedItems = [...items.values()].sort((a, b) => itemName(a).localeCompare(itemName(b), undefined, { sensitivity: "base", numeric: true }));
    const mappedMasters = {
      Suppliers: [...suppliers.values()].map((row) => {
        const metadata = parseJson(row.remarks);
        return [row.supplier_name, row.address || "", metadata.organizationType || (row.tax_identification_number ? "Non-government" : "Government"), row.tax_identification_number || "", metadata.taxType || "", row.status || "Active"];
      }),
      UACS: [...uacs.values()].map((row) => [row.uacs_code, row.account_title, row.account_category, row.ppe_sub_major || "", row.gl_account || "", row.active === false ? "Inactive" : "Active"]),
      Categories: [...categories.values()].map((row) => [row.category_name, row.classification_rule || "", row.default_classification || "", row.threshold_based_classification_enabled ? "Yes" : "No", row.active === false ? "Inactive" : "Active"]),
      Items: sortedItems.map((row) => [row.item_code, itemName(row), categories.get(row.category_id)?.category_name || "", row.unit_of_measure || "", uacs.get(row.default_uacs_account_id)?.uacs_code || "", String(row.reorder_level || 0), row.default_classification || categories.get(row.category_id)?.default_classification || ""]),
      ItemDetails: sortedItems.map((row) => [row.item_name, row.description || "", row.default_classification === "Expendable" ? row.item_code : ""]),
      Employees: [...employees.values()].map((row) => [row.employee_number || "", row.full_name, row.plantilla_position || "", offices.get(row.office_id)?.name || "", row.employment_status || "", row.active === false ? "Inactive" : "Active"]),
      Plantilla: settings.filter((row) => text(row.setting_key).startsWith("plantilla_position:")).map((row) => [row.text_value || "", parseJson(row.json_value).active === false ? "Inactive" : "Active"]).filter((row) => row[0]).sort((a, b) => a[0].localeCompare(b[0])),
      Departments: [...offices.values()].map((row) => [row.code || row.name]).sort((a, b) => a[0].localeCompare(b[0])),
      UOM: settings.filter((row) => text(row.setting_key).startsWith("uom:")).map((row) => [parseJson(row.json_value).name || row.text_value || "", row.text_value || ""]).filter((row) => row[0]).sort((a, b) => a[0].localeCompare(b[0])),
      ProcurementModes: settings.filter((row) => text(row.setting_key).startsWith("procurement_mode:")).map((row) => [row.text_value || "", parseJson(row.json_value).active === false ? "Inactive" : "Active"]).filter((row) => row[0]).sort((a, b) => a[0].localeCompare(b[0]))
    };

    const mappedPos = [...poRows.values()].map((row) => {
      const supplier = suppliers.get(row.supplier_id);
      const lines = poItems.filter((line) => line.purchase_order_id === row.id).map((line) => {
        const item = items.get(line.item_id);
        return { dbId: line.id, itemId: line.item_id, itemNo: line.line_number, uom: item?.unit_of_measure || "", description: item ? itemName(item) : line.item_description || "", classification: item?.default_classification || categories.get(item?.category_id)?.default_classification || "", qty: number(line.quantity_ordered), unitCost: number(line.unit_cost), total: number(line.total_cost) };
      });
      const record = [row.po_number || "N/A", dateLabel(row.po_date), supplier?.supplier_name || "", row.purchase_request_number || "", row.mode_of_procurement || "", lines.reduce((sum, line) => sum + line.total, 0), row.status || "Draft", [...iarRows.values()].some((iar) => iar.purchase_order_id === row.id), lines, supplier?.address || row.supplier_address || "", row.delivery_location || "", row.delivery_period || "", row.fund_source || ""];
      record.dbId = row.id; record.isoDate = row.po_date; record.purpose = row.purpose || "";
      return record;
    }).sort((a, b) => text(b.isoDate).localeCompare(text(a.isoDate)));

    const mappedIars = [...iarRows.values()].map((row) => {
      const po = poRows.get(row.purchase_order_id);
      const supplier = suppliers.get(po?.supplier_id);
      const poLines = poItems.filter((line) => line.purchase_order_id === po?.id);
      const lines = poLines.map((line) => {
        const item = items.get(line.item_id);
        const inspection = iarItems.find((entry) => entry.iar_id === row.id && entry.purchase_order_item_id === line.id);
        return { dbId: line.id, inspectionId: inspection?.id, itemId: line.item_id, itemNo: line.line_number, uom: item?.unit_of_measure || "", description: line.item_description || itemName(item), generalName: item?.item_name || "", itemDescription: item?.description || "", stockNumber: item?.item_code || "", reorderLevel: number(item?.reorder_level), classification: item?.default_classification || categories.get(item?.category_id)?.default_classification || "", qty: number(inspection?.quantity_accepted), orderedQty: number(line.quantity_ordered), unitCost: number(line.unit_cost), total: number(line.total_cost) };
      });
      const accepted = lines.reduce((sum, line) => sum + line.qty, 0);
      const record = [row.iar_number || "", po?.po_number || "", supplier?.supplier_name || "", dateLabel(row.iar_date), `${accepted} / ${lines.reduce((sum, line) => sum + line.orderedQty, 0)}`, "Upon completion", row.status || "Draft", lines];
      record.dbId = row.id; record.isoDate = row.iar_date; record.invoiceNo = row.invoice_number || ""; record.invoiceDate = dateLabel(row.invoice_date); record.invoiceIsoDate = row.invoice_date || "";
      return record;
    }).sort((a, b) => text(b.isoDate).localeCompare(text(a.isoDate)));

    const mappedProperty = (data.property_units || []).map((row) => {
      const item = items.get(row.item_id); const employee = employees.get(row.issued_to_employee_id); const po = poRows.get(row.purchase_order_id); const iar = iarRows.get(row.iar_id); const account = uacs.get(row.uacs_account_id);
      const issuedBy = employees.get(row.ics_issued_by_employee_id); const approvedBy = employees.get(row.ics_approved_by_employee_id);
      return { dbId: row.id, sourceIarItemId: row.source_iar_item_id, number: row.property_number || "", parNumber: row.par_number || text(row.remarks).match(/\[PAR No\.:\s*([^\]]+)\]/i)?.[1]?.trim().toUpperCase() || "", parYear: number(row.par_year), parSequence: number(row.par_sequence), classification: row.classification, item: item?.item_name || row.item_description || "", description: item?.description || row.item_description || item?.item_name || "", brand: row.brand || "", model: row.model || "", serial: row.serial_number || "", cost: number(row.acquisition_cost), date: dateLabel(row.date_acquired), isoDate: row.date_acquired, acceptedDate: row.date_accepted, issuedDate: dateLabel(row.issued_at), po: po?.po_number || "", iar: iar?.iar_number || "", supplier: suppliers.get(row.supplier_id)?.supplier_name || "", uom: item?.unit_of_measure || "Unit", usefulLife: number(item?.useful_life_years || 5), employee: employee?.full_name || "", employeeId: row.issued_to_employee_id || "", position: row.employee_plantilla_position || employee?.plantilla_position || "", office: offices.get(row.office_id)?.name || "", location: row.current_location || "", condition: row.condition || "Serviceable", status: row.current_status || "Available", fundSource: row.fund_source || po?.fund_source || "Regular Fund 01", uacsCode: account?.uacs_code || "", icsNumber: row.ics_number || "", icsYear: number(row.ics_year), icsSequence: number(row.ics_sequence), inventoryNumber: row.inventory_item_number || "", issuedBy: issuedBy?.full_name || "", issuedByPosition: issuedBy?.plantilla_position || "", approvedBy: approvedBy?.full_name || "", approvedByPosition: approvedBy?.plantilla_position || "", otherInfo: row.other_info || "", remarks: row.remarks || "" };
    });

    const mappedRis = risRows.map((row) => {
      const lines = risItems.filter((line) => line.ris_id === row.id).map((line) => {
        const item = items.get(line.item_id); const lineAllocations = allocations.filter((allocation) => allocation.ris_item_id === line.id); const metadata = parseJson(line.remarks); const batchId = metadata.selectedBatchId || lineAllocations[0]?.inventory_batch_id || ""; const batch = batches.find((entry) => entry.id === batchId); const qty = number(line.quantity_issued || line.quantity_requested); const totalCost = lineAllocations.reduce((sum, allocation) => sum + number(allocation.total_value ?? number(allocation.quantity) * number(allocation.unit_cost)), 0) || qty * number(batch?.unit_cost);
        return { dbId: line.id, batchId, batchLabel: `${itemName(item)}${batch ? ` (${dateLabel(batch.date_received)})` : ""}`, itemId: line.item_id, description: itemName(item), generalName: item?.item_name || "", itemDescription: item?.description || "", stockNumber: item?.item_code || "", classification: item?.default_classification || categories.get(item?.category_id)?.default_classification || "", category: categories.get(item?.category_id)?.category_name || "", uacsCode: uacs.get(item?.default_uacs_account_id)?.uacs_code || "", rsmiClassification: uacs.get(item?.default_uacs_account_id)?.account_title || "", uom: item?.unit_of_measure || "", requestedQty: number(line.quantity_requested), issuedQty: number(line.quantity_issued), qty, unitCost: qty ? totalCost / qty : number(batch?.unit_cost), totalCost, remarks: metadata.userRemarks || (typeof line.remarks === "string" && !line.remarks.startsWith("{") ? line.remarks : "") };
      });
      const requested = employees.get(row.requested_by_employee_id);
      return { dbId: row.id, number: row.ris_number, date: dateLabel(row.ris_date), isoDate: row.ris_date, office: offices.get(row.requesting_office_id)?.name || "", purpose: row.purpose || "", requestedBy: requested?.full_name || "", requestedPosition: requested?.plantilla_position || "", approvedBy: row.approved_by || "", issuedBy: row.issued_by || "", receivedBy: row.received_by || "", remarks: row.remarks || "", items: lines.length, value: lines.reduce((sum, line) => sum + number(line.totalCost), 0), status: row.status || "Draft", inRsmi: false, lines };
    });

    const rsmiLinks = data.rsmi_ris_records || [];
    const includedRisIds = new Set(rsmiLinks.map((link) => link.ris_id));
    mappedRis.forEach((record) => { record.inRsmi = includedRisIds.has(record.dbId); });
    const mappedRsmi = (data.rsmi_reports || []).map((row) => {
      const metadata = parseJson(row.remarks); const linkedIds = rsmiLinks.filter((link) => link.rsmi_id === row.id).map((link) => link.ris_id); const linked = mappedRis.filter((record) => linkedIds.includes(record.dbId)); const classification = metadata.classification || "";
      return { dbId: row.id, number: row.rsmi_number, classification, certifiedBy: metadata.certifiedBy || "", certifiedPosition: metadata.certifiedPosition || "", certifiedDate: metadata.certifiedDate || "", postedBy: metadata.postedBy || "", postedPosition: metadata.postedPosition || "", postedDate: metadata.postedDate || "", from: row.reporting_period_start, to: row.reporting_period_end, period: `${dateLabel(row.reporting_period_start)} – ${dateLabel(row.reporting_period_end)}`, prepared: dateLabel(row.date_prepared), ris: linked.map((record) => record.number), risIds: linkedIds, value: linked.reduce((sum, record) => sum + record.lines.filter((line) => !classification || line.rsmiClassification === classification).reduce((lineSum, line) => lineSum + number(line.totalCost), 0), 0), status: row.status || "Completed" };
    });

    const openBatches = batches.filter((batch) => batch.status === "Open" && number(batch.quantity_remaining) > 0).sort((a, b) => text(a.date_received).localeCompare(text(b.date_received)) || text(a.created_at).localeCompare(text(b.created_at)));
    const counts = new Map(); const totals = new Map();
    openBatches.forEach((batch) => { counts.set(batch.item_id, (counts.get(batch.item_id) || 0) + 1); totals.set(batch.item_id, (totals.get(batch.item_id) || 0) + number(batch.quantity_remaining)); });
    const available = openBatches.map((batch) => { const item = items.get(batch.item_id); const name = itemName(item); const sourceLine = iarItems.find((line) => line.id === batch.source_iar_item_id); const sourceIar = iarRows.get(sourceLine?.iar_id); return { batchId: batch.id, itemId: batch.item_id, itemName: name, label: counts.get(batch.item_id) > 1 ? `${name} (${dateLabel(batch.date_received)})` : name, date: batch.date_received, displayDate: dateLabel(batch.date_received), iarNumber: sourceIar?.iar_number || "", uom: item?.unit_of_measure || "", batchAvailable: number(batch.quantity_remaining), totalAvailable: number(totals.get(batch.item_id)), unitCost: number(batch.unit_cost) }; });

    return { pos: mappedPos, iars: mappedIars, risRecords: mappedRis, propertyUnits: mappedProperty, rsmiRecords: mappedRsmi, masters: mappedMasters, risAvailableBatches: available, employeeAccounts: [...employees.values()].map((row) => ({ id: row.id, full_name: row.full_name, position: row.plantilla_position })) };
  }

  try {
    let state = parseJson(localStorage.getItem(STATE_KEY));
    if (!state.pos) {
      let response = await fetch("/data/dmw-data-transfer.json", { cache: "no-store" });
      if (!response.ok) response = await fetch("/data/dmw-data-transfer.sample.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`Workspace data package could not be loaded (${response.status}).`);
      const bundle = await response.json();
      const expected = Object.values(bundle.record_counts || {}).reduce((sum, count) => sum + Number(count), 0);
      const actual = Object.values(bundle.data || {}).reduce((sum, rows) => sum + rows.length, 0);
      if (expected !== actual) throw new Error("Transfer validation failed; no partial data was applied.");
      state = mapTransfer(bundle);
    }
    applyState(state);
    window.inventoryAccess = { isSuperAdmin: true, canWrite: true, canDelete: true, canUnpost: true, profile: { id: "sinop-superadmin", role: "super_admin", full_name: "Sinop Superadmin" } };
    window.inventoryUserProfiles = [{ id: "sinop-superadmin", email: "superadmin@sinop.local", full_name: "Sinop Superadmin", role: "super_admin", active: true }];
    window.inventoryAuditLogs = [];
    const originalRender = render;
    render = function renderAndPersist(view) {
      localStorage.setItem(STATE_KEY, JSON.stringify({ pos, iars, risRecords, propertyUnits, rsmiRecords, masters, risAvailableBatches: window.risAvailableBatches || [], employeeAccounts: window.inventoryEmployeeAccounts || [] }));
      originalRender(view);
      applyTheme();
    };
    applyTheme();
    render("Dashboard");
  } catch (error) {
    document.querySelector("#main").innerHTML = `<section class="panel"><div class="empty-state"><span>!</span><h3>Workspace could not be initialized</h3><p>${text(error?.message || error)}</p></div></section>`;
  }
})();
