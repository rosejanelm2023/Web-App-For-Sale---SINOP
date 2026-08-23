(() => {
  const api = window.supabaseApi;
  const refs = { suppliers: new Map(), items: new Map(), offices: new Map(), employees: new Map(), plantilla: new Map(), uacs: new Map(), categories: new Map(), uoms: new Map(), procurementModes: new Map() };
  let access = null;
  let entrySelected = false;
  let historyNavigation = false;
  let viewerProperty = [];
  const requiredDepartments = ["FAD", "ORD", "WRSD", "MWPSD", "MWPTD"];
  const classificationSequence = ["Expendable", "Semi-Expendable", "Capital Outlay"];
  const defaultProcurementModes = [
    "Competitive Bidding",
    "Limited Source Bidding",
    "Competitive Dialogue",
    "Unsolicited Offer with Bid Matching",
    "Direct Contracting",
    "Direct Acquisition",
    "Repeat Order",
    "Small Value Procurement",
    "Negotiated Procurement",
    "Direct Sales",
    "Direct Procurement for Science, Technology, and Innovation",
    "Agency-To-Agency",
  ];
  const employeePositions = [
    "Regional Director",
    "Assistant Regional Director",
    "OIC - Regional Director",
    "OIC - ARD",
    "OIC - ARD / CAO",
    "Chief, FAD",
    "Chief, LEO",
    "Sv. LEO",
    "Sr. LEO",
    "LEO III",
    "LEO II",
    "LEO I",
    "SAO",
    "AO V",
    "Accountant III",
    "AO IV",
    "AO III",
    "AO II",
    "AO I",
    "ADAS III",
    "ADAS II",
    "Job Order",
    "Atty. II",
    "Atty. III",
    "Atty. IV",
    "OAE",
  ];
  const dateLabel = (value) => value
    ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })
    : "";
  const escapeProfile = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const profileName = (profile = {}) => profile.display_name || profile.full_name || profile.email || "User";
  const profileRole = (profile = {}) => ({ super_admin: "Super Admin", staff: "Staff", viewer: "Viewer", pending: "Pending" }[profile.role] || "User");
  const defaultAgencyBranding = { agencyName: "Your Agency", agencyColor: "#B7FF72", headerDataUrl: "" };
  let agencyBranding = { ...defaultAgencyBranding };

  function agencyBrandingKey() {
    return `agency-inventory-branding:${String(access?.profile?.email || "guest").toLowerCase()}`;
  }

  function loadAgencyBranding() {
    try {
      const saved = JSON.parse(localStorage.getItem(agencyBrandingKey()) || "null");
      agencyBranding = { ...defaultAgencyBranding, ...(saved || {}) };
    } catch {
      agencyBranding = { ...defaultAgencyBranding };
    }
    if (!/^#[0-9a-f]{6}$/i.test(agencyBranding.agencyColor || "")) agencyBranding.agencyColor = defaultAgencyBranding.agencyColor;
    return agencyBranding;
  }

  function saveAgencyBranding(nextBranding) {
    agencyBranding = { ...defaultAgencyBranding, ...nextBranding };
    localStorage.setItem(agencyBrandingKey(), JSON.stringify(agencyBranding));
    applyAgencyBranding();
  }

  function applyAgencyBranding(root = document) {
    const agencyName = String(agencyBranding.agencyName || "").trim() || defaultAgencyBranding.agencyName;
    const agencyColor = /^#[0-9a-f]{6}$/i.test(agencyBranding.agencyColor || "") ? agencyBranding.agencyColor : defaultAgencyBranding.agencyColor;
    document.documentElement.style.setProperty("--agency-accent", agencyColor);
    window.stockCardEntityName = agencyName;
    root.querySelectorAll?.("[data-agency-name]").forEach((node) => { node.textContent = agencyName; });
    root.querySelectorAll?.('img[src="/agency-header-placeholder.png"], img[data-agency-header]').forEach((image) => {
      image.dataset.agencyHeader = "true";
      image.alt = `${agencyName} official header`;
      if (agencyBranding.headerDataUrl) {
        image.hidden = false;
        if (image.src !== agencyBranding.headerDataUrl) image.src = agencyBranding.headerDataUrl;
      } else {
        image.hidden = true;
      }
    });
  }

  function fileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("The agency header could not be read."));
      reader.readAsDataURL(file);
    });
  }

  function historyUrl(route, view = "") {
    const base = `${location.pathname}${location.search}`;
    if (route === "viewer") return `${base}#view-mode`;
    if (route === "module") return `${base}#${encodeURIComponent(view || "Dashboard")}`;
    return `${base}#login`;
  }

  function syncHistory(route, view = "", method = "push") {
    if (historyNavigation) return;
    const state = { inventoryRoute: route, ...(route === "module" ? { view: view || "Dashboard" } : {}) };
    const existing = history.state || {};
    const sameRoute = existing.inventoryRoute === state.inventoryRoute;
    const sameView = route !== "module" || existing.view === state.view;
    if (method === "push" && sameRoute && sameView) return;
    history[method === "replace" ? "replaceState" : "pushState"](state, "", historyUrl(route, view));
  }

  function connectionScreen(title, message, withForm = false) {
    const isLoading = !withForm && /^Loading\b/i.test(title);
    document.body.classList.toggle("auth-mode", withForm);
    document.body.classList.toggle("loading-mode", isLoading);
    document.querySelector("#main").innerHTML = `<section class="connection-page"><div class="connection-card">
      ${withForm ? `<div class="connection-orbit" aria-hidden="true"><i></i><i></i><i></i></div><div class="connection-logo-bubble agency-login-mark" aria-label="Agency Inventory">AI</div>` : isLoading ? `<div class="dmw-loader" role="status" aria-label="Loading inventory workspace"><div class="loader-orbits" aria-hidden="true"><i></i><i></i><i></i></div><div class="loader-glass agency-loading-mark">AI</div><strong>Your agency. One workspace.</strong><span class="loader-line"></span></div>` : `<div class="connection-logo-bubble compact agency-login-mark" aria-label="Agency Inventory">AI</div>`}<p>Inventory and Property Management</p><h2>${title}</h2><p>${message}</p>
      ${withForm ? `<div class="auth-switch" role="tablist"><button class="active" id="show-login" type="button">Sign in</button><button id="show-register" type="button">Register</button></div><form id="backend-login"><label>Email address<input name="email" type="email" autocomplete="username" placeholder="name@agency.gov.ph" required></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><button class="primary-button full-button">Sign in securely</button><small id="login-error" role="alert"></small></form><form id="backend-register" hidden><label>Email address<input name="email" type="email" autocomplete="email" placeholder="name@agency.gov.ph" required></label><label>Password<input name="password" type="password" autocomplete="new-password" minlength="8" required></label><label>Confirm password<input name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required></label><button class="primary-button full-button">Submit registration</button><small id="register-message" role="alert"></small></form><div class="view-mode-divider"><span>or</span></div><button class="view-mode-entry" id="enter-view-mode" type="button"><span>View Mode</span><small>Read-only issued property lookup</small></button><p class="login-help">After approval, you will complete your profile and optional agency branding before entering the system.</p>` : ""}
    </div></section>`;
    applyAgencyBranding(document.querySelector("#main"));
  }

  async function refreshProfilePhoto() {
    const profile = access?.profile;
    const mark = document.querySelector(".profile-mark");
    if (!profile || !mark || !profile.avatar_path) return;
    try {
      if (!access.profilePhotoUrl) access.profilePhotoUrl = await api.signedProfilePhoto(profile.avatar_path);
      if (access.profilePhotoUrl && document.body.contains(mark)) {
        mark.innerHTML = `<img src="${escapeProfile(access.profilePhotoUrl)}" alt="${escapeProfile(profileName(profile))}">`;
      }
    } catch {}
  }

  function installAccountControls() {
    const trigger = document.querySelector("#account-trigger");
    const menu = document.querySelector("#account-menu");
    if (!trigger || !menu) return;
    const profile = access?.profile || {};
    menu.innerHTML = `<div class="account-menu-head"><strong>${escapeProfile(profileName(profile))}</strong><span>${escapeProfile(profile.email || "")}</span><small>${escapeProfile(profileRole(profile))}</small></div><button type="button" id="open-account-settings" role="menuitem">Profile settings</button><button type="button" id="backend-logout" role="menuitem">Sign out</button>`;
    trigger.onclick = (event) => {
      event.stopPropagation();
      const opening = menu.hidden;
      menu.hidden = !opening;
      trigger.setAttribute("aria-expanded", String(opening));
    };
    document.querySelector("#open-account-settings").onclick = () => {
      menu.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      openProfileEditor(false);
    };
    document.querySelector("#backend-logout").onclick = async () => {
      await api.signOut();
      location.reload();
    };
    if (!document.body.dataset.accountDismissBound) {
      document.body.dataset.accountDismissBound = "true";
      document.addEventListener("click", (event) => {
        const area = document.querySelector(".account-area");
        const current = document.querySelector("#account-menu");
        const currentTrigger = document.querySelector("#account-trigger");
        if (current && area && !area.contains(event.target)) {
          current.hidden = true;
          currentTrigger?.setAttribute("aria-expanded", "false");
        }
      });
    }
  }

  function updateSignedInProfile() {
    const profile = access?.profile;
    if (!profile) return;
    document.body.classList.remove("auth-mode");
    document.body.classList.remove("loading-mode");
    const initials = String(profileName(profile)).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
    const roleLabel = profileRole(profile);
    const mark = document.querySelector(".profile-mark");
    const name = document.querySelector(".profile-copy strong");
    const role = document.querySelector(".profile-copy small");
    if (mark && !profile.avatar_path && mark.textContent !== initials) mark.textContent = initials;
    if (name && name.textContent !== profileName(profile)) name.textContent = profileName(profile);
    if (role && role.textContent !== roleLabel) role.textContent = roleLabel;
    if (profile.avatar_path) void refreshProfilePhoto();
  }

  function profileEditorMarkup(profile, required) {
    return `<section class="account-editor ${required ? "required-profile" : ""}"><div class="account-editor-heading"><div><p>${required ? "COMPLETE YOUR ACCOUNT" : "ACCOUNT SETTINGS"}</p><h2>${required ? "Set up your workspace" : "Profile and agency settings"}</h2><span>${required ? "Complete your profile, then optionally personalize the workspace for your agency." : "Keep your profile and agency branding up to date."}</span></div>${required ? "" : `<button type="button" class="modal-close" id="close-account-editor" aria-label="Close">×</button>`}</div><form id="account-profile-form"><div class="profile-photo-field"><div class="profile-photo-preview" id="profile-photo-preview">${access?.profilePhotoUrl ? `<img src="${escapeProfile(access.profilePhotoUrl)}" alt="Profile photo">` : `<span>${escapeProfile(String(profileName(profile)).slice(0, 1).toUpperCase())}</span>`}</div><label><strong>Profile photo <small>Optional</small></strong><span>PNG or JPG, maximum 3 MB</span><input type="file" name="photo" accept="image/png,image/jpeg"></label></div><div class="profile-fields"><label>First Name<input name="firstName" autocomplete="given-name" value="${escapeProfile(profile.first_name || "")}" required></label><label>Middle Initial <small>Optional</small><input name="middleInitial" maxlength="2" value="${escapeProfile(profile.middle_initial || "")}" placeholder="M"></label><label>Last Name<input name="lastName" autocomplete="family-name" value="${escapeProfile(profile.last_name || "")}" required></label><label>Nick Name or Display Name<input name="displayName" value="${escapeProfile(profile.display_name || "")}" placeholder="How your name appears in the app" required></label></div><fieldset class="agency-branding-fields"><legend>Agency branding <small>Optional</small></legend><p>You can skip these fields and personalize the workspace later.</p><div class="agency-branding-grid"><label>Agency name<input name="agencyName" value="${escapeProfile(agencyBranding.agencyName === defaultAgencyBranding.agencyName ? "" : agencyBranding.agencyName)}" placeholder="Example: Provincial Government of Agusan"></label><label>Agency color<span class="agency-color-control"><input type="color" name="agencyColor" value="${escapeProfile(agencyBranding.agencyColor)}"><output id="agency-color-value">${escapeProfile(agencyBranding.agencyColor.toUpperCase())}</output></span></label><label class="agency-header-field">Official header<input type="file" name="agencyHeader" accept="image/png,image/jpeg"><small>PNG or JPG, maximum 2 MB. Used on printable forms and reports.</small></label><div class="agency-header-preview" id="agency-header-preview">${agencyBranding.headerDataUrl ? `<img src="${escapeProfile(agencyBranding.headerDataUrl)}" alt="Current agency header">` : `<span>No header uploaded</span>`}</div></div></fieldset><div class="account-editor-actions">${required ? "" : `<button type="button" class="secondary-button" id="cancel-account-editor">Cancel</button>`}<button type="submit" class="primary-button">Save and continue</button></div><small class="profile-form-message" id="profile-form-message" role="alert"></small></form></section>`;
  }

  function openProfileEditor(required = false) {
    const profile = access?.profile || {};
    const host = required ? document.querySelector("#main") : document.querySelector("#modal");
    if (!host) return;
    if (required) {
      document.body.classList.remove("loading-mode", "auth-mode");
      document.body.classList.add("profile-setup-mode");
      host.innerHTML = `<div class="profile-setup-page">${profileEditorMarkup(profile, true)}</div>`;
    } else {
      host.innerHTML = `<div class="modal-backdrop account-modal-backdrop">${profileEditorMarkup(profile, false)}</div>`;
    }
    const close = () => { if (!required) host.innerHTML = ""; };
    document.querySelector("#close-account-editor")?.addEventListener("click", close);
    document.querySelector("#cancel-account-editor")?.addEventListener("click", close);
    const photoInput = document.querySelector('#account-profile-form input[name="photo"]');
    const agencyHeaderInput = document.querySelector('#account-profile-form input[name="agencyHeader"]');
    const agencyColorInput = document.querySelector('#account-profile-form input[name="agencyColor"]');
    photoInput?.addEventListener("change", () => {
      const file = photoInput.files?.[0];
      const message = document.querySelector("#profile-form-message");
      if (!file) return;
      if (!["image/png", "image/jpeg"].includes(file.type) || file.size > 3 * 1024 * 1024) {
        photoInput.value = "";
        message.textContent = "Choose a PNG or JPG file up to 3 MB.";
        return;
      }
      document.querySelector("#profile-photo-preview").innerHTML = `<img src="${URL.createObjectURL(file)}" alt="Selected profile photo">`;
      message.textContent = "";
    });
    agencyColorInput?.addEventListener("input", () => {
      document.querySelector("#agency-color-value").textContent = agencyColorInput.value.toUpperCase();
    });
    agencyHeaderInput?.addEventListener("change", async () => {
      const file = agencyHeaderInput.files?.[0];
      const message = document.querySelector("#profile-form-message");
      if (!file) return;
      if (!["image/png", "image/jpeg"].includes(file.type) || file.size > 2 * 1024 * 1024) {
        agencyHeaderInput.value = "";
        message.textContent = "Choose a PNG or JPG agency header up to 2 MB.";
        return;
      }
      const previewUrl = await fileAsDataUrl(file);
      document.querySelector("#agency-header-preview").innerHTML = `<img src="${escapeProfile(previewUrl)}" alt="Selected agency header">`;
      message.textContent = "";
    });
    document.querySelector("#account-profile-form").onsubmit = async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector('button[type="submit"]');
      const message = document.querySelector("#profile-form-message");
      const data = new FormData(form);
      button.disabled = true;
      button.textContent = "Saving…";
      message.textContent = "";
      try {
        let avatarPath = profile.avatar_path || null;
        const photo = data.get("photo");
        if (photo instanceof File && photo.size) avatarPath = await api.uploadProfilePhoto(photo);
        const saved = await api.rpc("save_my_profile", {
          p_first_name: String(data.get("firstName") || "").trim(),
          p_middle_initial: String(data.get("middleInitial") || "").trim(),
          p_last_name: String(data.get("lastName") || "").trim(),
          p_display_name: String(data.get("displayName") || "").trim(),
          p_avatar_path: avatarPath,
        });
        let headerDataUrl = agencyBranding.headerDataUrl || "";
        const agencyHeader = data.get("agencyHeader");
        if (agencyHeader instanceof File && agencyHeader.size) headerDataUrl = await fileAsDataUrl(agencyHeader);
        saveAgencyBranding({
          agencyName: String(data.get("agencyName") || "").trim() || defaultAgencyBranding.agencyName,
          agencyColor: String(data.get("agencyColor") || defaultAgencyBranding.agencyColor),
          headerDataUrl,
        });
        access.profile = Array.isArray(saved) ? saved[0] : saved;
        access.profilePhotoUrl = "";
        window.inventoryAccess = access;
        document.body.classList.remove("profile-setup-mode");
        if (required) await finishStartup();
        else {
          close();
          updateSignedInProfile();
          installAccountControls();
          showToast("Profile settings saved.");
        }
      } catch (error) {
        button.disabled = false;
        button.textContent = "Save profile";
        message.textContent = error.message;
      }
    };
  }

  async function loadData() {
    const [suppliers, uacs, categories, items, poRows, poItems, iarRows, iarItems, offices, employees, risRows, risItems, settings, risAllocations, propertyRows, inventoryBatches, rsmiRows, rsmiLinks] = await Promise.all([
      api.select("suppliers", "select=*&order=supplier_name"),
      api.select("uacs_accounts", "select=*&order=uacs_code"),
      api.select("item_categories", "select=*&order=category_name"),
      api.select("items", "select=*&order=item_name"),
      api.select("purchase_orders", "select=*&order=po_date.desc"),
      api.select("purchase_order_items", "select=*&order=line_number"),
      api.select("inspection_acceptance_reports", "select=*&order=iar_date.desc"),
      api.select("inspection_acceptance_items", "select=*"),
      api.select("offices", "select=*&order=name"),
      api.select("employees", "select=*&order=full_name"),
      api.select("requisition_issue_slips", "select=*&order=ris_date.desc"),
      api.select("requisition_issue_slip_items", "select=*&order=line_number"),
      api.select("system_settings", "select=*&order=setting_key"),
      api.select("ris_batch_allocations", "select=*"),
      api.select("property_units", "select=*&order=date_acquired,unit_sequence"),
      api.select("inventory_batches", "select=*&order=date_received,created_at,id"),
      api.select("rsmi_reports", "select=*&order=reporting_period_start.desc,created_at.desc"),
      api.select("rsmi_ris_records", "select=*"),
    ]);

    const missingDepartments = requiredDepartments.filter((code) => !offices.some((row) => row.code === code));
    if (missingDepartments.length && (access?.isSuperAdmin || access?.isStaff)) {
      const createdDepartments = await api.insert("offices", missingDepartments.map((code) => ({ code, name: code, active: true })));
      offices.push(...createdDepartments);
    }

    const savedProcurementModes = settings.filter((row) => row.setting_key.startsWith("procurement_mode:"));
    const savedModeNames = new Set(savedProcurementModes.map((row) => String(row.text_value || "").trim().toLowerCase()));
    const missingProcurementModes = savedProcurementModes.length
      ? []
      : defaultProcurementModes.filter((name) => !savedModeNames.has(name.toLowerCase()));
    if (missingProcurementModes.length && (access?.isSuperAdmin || access?.isStaff)) {
      const createdModes = await api.insert("system_settings", missingProcurementModes.map((name) => ({
        setting_key: `procurement_mode:${crypto.randomUUID()}`,
        text_value: name,
        json_value: { active: true },
        description: "Purchase Order mode of procurement",
      })));
      settings.push(...createdModes);
    }

    const savedPlantilla = settings.filter((row) => row.setting_key.startsWith("plantilla_position:"));
    const savedPlantillaNames = new Set(savedPlantilla.map((row) => String(row.text_value || "").trim().toLowerCase()).filter(Boolean));
    const plantillaSourceNames = [...employeePositions, ...employees.map((row) => row.plantilla_position)]
      .map((name) => String(name || "").trim())
      .filter(Boolean);
    const missingPlantillaNames = [...new Map(plantillaSourceNames.map((name) => [name.toLowerCase(), name])).entries()]
      .filter(([normalized]) => !savedPlantillaNames.has(normalized))
      .map(([, name]) => name);
    if (missingPlantillaNames.length && (access?.isSuperAdmin || access?.isStaff)) {
      const createdPositions = await api.insert("system_settings", missingPlantillaNames.map((name) => ({
        setting_key: `plantilla_position:${crypto.randomUUID()}`,
        text_value: name,
        json_value: { active: true },
        description: "Employee Plantilla position",
      })));
      settings.push(...createdPositions);
    }

    const supplierById = new Map(suppliers.map((row) => [row.id, row]));
    const uacsById = new Map(uacs.map((row) => [row.id, row]));
    const categoryById = new Map(categories.map((row) => [row.id, row]));
    const itemById = new Map(items.map((row) => [row.id, row]));
    const iarItemById = new Map(iarItems.map((row) => [row.id, row]));
    const iarById = new Map(iarRows.map((row) => [row.id, row]));
    const officeById = new Map(offices.map((row) => [row.id, row]));
    const employeeById = new Map(employees.map((row) => [row.id, row]));
    const poById = new Map(poRows.map((row) => [row.id, row]));
    const itemDisplayName = (row) => row.description && row.description !== row.item_name
      ? `${row.item_name} — ${row.description}`
      : row.item_name;
    const itemClassification = (row) => row.default_classification || categoryById.get(row.category_id)?.default_classification || "";
    const sortedItems = [...items].sort((a, b) => {
      const classificationDifference = classificationSequence.indexOf(itemClassification(a)) - classificationSequence.indexOf(itemClassification(b));
      return classificationDifference || a.item_name.localeCompare(b.item_name) || String(a.description || "").localeCompare(String(b.description || ""));
    });
    refs.suppliers = new Map(suppliers.map((row) => [row.supplier_name, row]));
    refs.items = new Map(sortedItems.map((row) => [itemDisplayName(row), row]));
    refs.offices = new Map(offices.map((row) => [row.name, row]));
    refs.employees = new Map(employees.map((row) => [row.full_name, row]));
    window.inventoryEmployeeAccounts = employees.map((row) => ({ id: row.id, full_name: row.full_name, position: row.plantilla_position }));
    refs.uacs = new Map(uacs.map((row) => [row.uacs_code, row]));
    refs.categories = new Map(categories.map((row) => [row.default_classification || row.category_name, row]));
    const uomRows = settings.filter((row) => row.setting_key.startsWith("uom:"));
    const procurementModeRows = settings
      .filter((row) => row.setting_key.startsWith("procurement_mode:"))
      .sort((a, b) => String(a.text_value || "").localeCompare(String(b.text_value || "")));
    const plantillaRows = settings
      .filter((row) => row.setting_key.startsWith("plantilla_position:"))
      .sort((a, b) => String(a.text_value || "").localeCompare(String(b.text_value || "")));
    refs.uoms = new Map(uomRows.map((row) => [row.json_value?.name || "", row]));
    refs.procurementModes = new Map(procurementModeRows.map((row) => [String(row.text_value || "").trim(), row]));
    refs.plantilla = new Map(plantillaRows.map((row) => [String(row.text_value || "").trim(), row]));
    window.stockCardEntityName = agencyBranding.agencyName || defaultAgencyBranding.agencyName;

    masters.Suppliers = suppliers.map((row) => {
      let metadata = {};
      try { metadata = JSON.parse(row.remarks || "{}"); } catch {}
      const organizationType = metadata.organizationType || (row.tax_identification_number ? "Non-government" : "Government");
      return [row.supplier_name, row.address || "", organizationType, row.tax_identification_number || "", metadata.taxType || "", row.status];
    });
    masters.UACS = uacs.map((row) => [row.uacs_code, row.account_title, row.account_category, row.ppe_sub_major || "", row.gl_account || "", row.active ? "Active" : "Inactive"]);
    masters.Categories = categories.map((row) => [row.category_name, row.classification_rule, row.default_classification || "", row.threshold_based_classification_enabled ? "Yes" : "No", row.active ? "Active" : "Inactive"]);
    masters.Items = sortedItems.map((row) => {
      const category = categoryById.get(row.category_id);
      return [row.item_code, itemDisplayName(row), category?.category_name || "", row.unit_of_measure, uacsById.get(row.default_uacs_account_id)?.uacs_code || "", String(row.reorder_level || 0), row.default_classification || category?.default_classification || ""];
    });
    masters.ItemDetails = sortedItems.map((row) => [
      row.item_name,
      row.description || "",
      row.default_classification === "Expendable" ? row.item_code : "",
    ]);
    masters.Employees = employees.map((row) => [row.employee_number, row.full_name, row.plantilla_position, officeById.get(row.office_id)?.name || "", row.employment_status, row.active ? "Active" : "Inactive"]);
    masters.Plantilla = plantillaRows.map((row) => [row.text_value || "", row.json_value?.active === false ? "Inactive" : "Active"]).filter((row) => row[0]);
    masters.Departments = requiredDepartments.map((code) => [code]);
    masters.UOM = uomRows.map((row) => [row.json_value?.name || "", row.text_value || ""]).filter((row) => row[0]);
    masters.ProcurementModes = procurementModeRows.map((row) => [row.text_value || "", row.json_value?.active === false ? "Inactive" : "Active"]).filter((row) => row[0]);

    const openInventoryBatches = inventoryBatches.filter((batch) => batch.status === "Open" && Number(batch.quantity_remaining) > 0);
    openInventoryBatches.sort((first, second) => {
      const firstName = itemById.get(first.item_id) ? itemDisplayName(itemById.get(first.item_id)) : "Unnamed item";
      const secondName = itemById.get(second.item_id) ? itemDisplayName(itemById.get(second.item_id)) : "Unnamed item";
      return firstName.localeCompare(secondName, undefined, { sensitivity: "base", numeric: true })
        || String(first.date_received || "").localeCompare(String(second.date_received || ""))
        || String(first.created_at || "").localeCompare(String(second.created_at || ""))
        || String(first.id).localeCompare(String(second.id));
    });
    const batchCountByItem = new Map();
    const availableByItem = new Map();
    openInventoryBatches.forEach((batch) => {
      batchCountByItem.set(batch.item_id, (batchCountByItem.get(batch.item_id) || 0) + 1);
      availableByItem.set(batch.item_id, (availableByItem.get(batch.item_id) || 0) + Number(batch.quantity_remaining || 0));
    });
    window.risAvailableBatches = openInventoryBatches.map((batch) => {
      const item = itemById.get(batch.item_id);
      const sourceLine = iarItemById.get(batch.source_iar_item_id);
      const sourceIar = iarById.get(sourceLine?.iar_id);
      const itemName = item ? itemDisplayName(item) : "Unnamed item";
      const receivedDate = dateLabel(batch.date_received);
      return {
        batchId: batch.id,
        itemId: batch.item_id,
        itemName,
        label: batchCountByItem.get(batch.item_id) > 1 ? `${itemName} (${receivedDate})` : itemName,
        date: batch.date_received,
        displayDate: receivedDate,
        iarNumber: sourceIar?.iar_number || "",
        uom: item?.unit_of_measure || "",
        batchAvailable: Number(batch.quantity_remaining || 0),
        totalAvailable: Number(availableByItem.get(batch.item_id) || 0),
        unitCost: Number(batch.unit_cost || 0),
      };
    });

    const databasePos = poRows.map((row) => {
      const supplier = supplierById.get(row.supplier_id);
      const lines = poItems.filter((line) => line.purchase_order_id === row.id).map((line) => {
        const item = itemById.get(line.item_id);
        return { dbId: line.id, itemId: line.item_id, itemNo: line.line_number, uom: item?.unit_of_measure || "", description: item ? itemDisplayName(item) : line.item_description || "", classification: item ? itemClassification(item) : "", qty: Number(line.quantity_ordered), unitCost: Number(line.unit_cost), total: Number(line.total_cost) };
      });
      const record = [row.po_number, dateLabel(row.po_date), supplier?.supplier_name || "", row.purchase_request_number || "", row.mode_of_procurement || "", lines.reduce((sum, line) => sum + line.total, 0), row.status, iarRows.some((iar) => iar.purchase_order_id === row.id), lines, supplier?.address || row.supplier_address || "", row.delivery_location || "", row.delivery_period || "", row.fund_source || ""];
      record.dbId = row.id;
      record.isoDate = row.po_date;
      record.purpose = row.purpose || "";
      return record;
    });
    pos = databasePos;

    iars = iarRows.map((row) => {
      const po = poById.get(row.purchase_order_id);
      const supplier = supplierById.get(po?.supplier_id);
      const lines = poItems.filter((line) => line.purchase_order_id === po?.id).map((line) => {
        const item = itemById.get(line.item_id);
        const inspection = iarItems.find((entry) => entry.iar_id === row.id && entry.purchase_order_item_id === line.id);
        return {
          dbId: line.id,
          inspectionId: inspection?.id,
          itemId: line.item_id,
          itemNo: line.line_number,
          uom: item?.unit_of_measure || "",
          description: line.item_description || (item ? itemDisplayName(item) : ""),
          generalName: item?.item_name || "",
          itemDescription: item?.description || "",
          stockNumber: item?.item_code || "",
          reorderLevel: Number(item?.reorder_level || 0),
          classification: item ? itemClassification(item) : "",
          qty: Number(inspection?.quantity_accepted || 0),
          orderedQty: Number(line.quantity_ordered),
          unitCost: Number(line.unit_cost),
          total: Number(line.total_cost)
        };
      });
      const accepted = iarItems.filter((line) => line.iar_id === row.id).reduce((sum, line) => sum + Number(line.quantity_accepted), 0);
      const record = [row.iar_number, po?.po_number || "", supplier?.supplier_name || "", dateLabel(row.iar_date), `${accepted} / ${lines.reduce((sum, line) => sum + line.orderedQty, 0)}`, "Upon completion", row.status, lines];
      record.dbId = row.id;
      record.isoDate = row.iar_date;
      record.invoiceNo = row.invoice_number || "";
      record.invoiceDate = dateLabel(row.invoice_date);
      record.invoiceIsoDate = row.invoice_date || "";
      return record;
    });

    propertyUnits = propertyRows.map((row) => {
      const item = itemById.get(row.item_id);
      const employee = employeeById.get(row.issued_to_employee_id);
      const issuedBy = employeeById.get(row.ics_issued_by_employee_id);
      const approvedBy = employeeById.get(row.ics_approved_by_employee_id);
      const office = officeById.get(row.office_id);
      const po = poById.get(row.purchase_order_id);
      const iar = iarRows.find((entry) => entry.id === row.iar_id);
      const uacs = uacsById.get(row.uacs_account_id);
      return {
        dbId: row.id,
        sourceIarItemId: row.source_iar_item_id,
        number: row.property_number || "",
        parNumber: row.par_number || String(row.remarks || "").match(/\[PAR No\.:\s*([^\]]+)\]/i)?.[1]?.trim().toUpperCase() || "",
        parYear: Number(row.par_year || 0),
        parSequence: Number(row.par_sequence || 0),
        classification: row.classification,
        item: item?.item_name || row.item_description || "",
        description: item?.description || row.item_description || item?.item_name || "",
        brand: row.brand || "",
        model: row.model || "",
        serial: row.serial_number || "",
        cost: Number(row.acquisition_cost || 0),
        date: dateLabel(row.date_acquired),
        isoDate: row.date_acquired,
        acceptedDate: row.date_accepted,
        issuedDate: dateLabel(row.issued_at),
        po: po?.po_number || "",
        iar: iar?.iar_number || "",
        supplier: supplierById.get(row.supplier_id)?.supplier_name || "",
        uom: item?.unit_of_measure || "Unit",
        usefulLife: Number(item?.useful_life_years || 5),
        employee: employee?.full_name || "",
        employeeId: row.issued_to_employee_id || "",
        position: row.employee_plantilla_position || employee?.plantilla_position || "",
        office: office?.name || "",
        location: row.current_location || "",
        condition: normalizedPropertyCondition(row.condition),
        status: row.current_status || "Available",
        fundSource: row.fund_source || po?.fund_source || "Regular Fund 01",
        uacsCode: uacs?.uacs_code || "",
        icsNumber: row.ics_number || "",
        icsYear: Number(row.ics_year || 0),
        icsSequence: Number(row.ics_sequence || 0),
        inventoryNumber: row.inventory_item_number || "",
        issuedBy: issuedBy?.full_name || "",
        issuedByPosition: issuedBy?.plantilla_position || "",
        approvedBy: approvedBy?.full_name || "",
        approvedByPosition: approvedBy?.plantilla_position || "",
        otherInfo: row.other_info || "",
        remarks: row.remarks || ""
      };
    });

    risRecords = risRows.map((row) => {
      const lines = risItems.filter((line) => line.ris_id === row.id).map((line) => {
        const item = itemById.get(line.item_id);
        const allocations = risAllocations.filter((allocation) => allocation.ris_item_id === line.id);
        let lineMetadata = {};
        try { lineMetadata = JSON.parse(line.remarks || "{}"); } catch { lineMetadata = { userRemarks: line.remarks || "" }; }
        const selectedBatchId = lineMetadata.selectedBatchId || allocations[0]?.inventory_batch_id || "";
        const selectedBatch = inventoryBatches.find((batch) => batch.id === selectedBatchId);
        const batchLabel = item
          ? `${itemDisplayName(item)}${selectedBatch ? ` (${dateLabel(selectedBatch.date_received)})` : ""}`
          : "";
        const issuedQuantity = Number(line.quantity_issued || line.quantity_requested);
        const allocatedCost = allocations.reduce((sum, allocation) => sum + Number(allocation.total_value ?? (Number(allocation.quantity) * Number(allocation.unit_cost))), 0);
        const selectedBatchUnitCost = Number(selectedBatch?.unit_cost || 0);
        const totalCost = allocations.length ? allocatedCost : issuedQuantity * selectedBatchUnitCost;
        return {
          dbId: line.id,
          batchId: selectedBatchId,
          batchLabel,
          itemId: line.item_id,
          description: item ? itemDisplayName(item) : "",
          generalName: item?.item_name || "",
          itemDescription: item?.description || "",
          stockNumber: item?.item_code || "",
          classification: item ? itemClassification(item) : "",
          category: item?.category_id ? categoryById.get(item.category_id)?.category_name || "" : "",
          uacsCode: item?.default_uacs_account_id ? uacsById.get(item.default_uacs_account_id)?.uacs_code || "" : "",
          rsmiClassification: item?.default_uacs_account_id ? uacsById.get(item.default_uacs_account_id)?.account_title || "" : "",
          uom: item?.unit_of_measure || "",
          requestedQty: Number(line.quantity_requested),
          issuedQty: Number(line.quantity_issued),
          qty: issuedQuantity,
          unitCost: allocations.length && issuedQuantity ? totalCost / issuedQuantity : selectedBatchUnitCost,
          totalCost,
          remarks: lineMetadata.userRemarks || ""
        };
      });
      const requestedEmployee = employeeById.get(row.requested_by_employee_id);
      return { dbId: row.id, number: row.ris_number, date: dateLabel(row.ris_date), isoDate: row.ris_date, office: officeById.get(row.requesting_office_id)?.name || "", purpose: row.purpose || "", requestedBy: requestedEmployee?.full_name || "", requestedPosition: requestedEmployee?.position || "", approvedBy: row.approved_by || "", issuedBy: row.issued_by || "", receivedBy: row.received_by || "", remarks: row.remarks || "", items: lines.length, value: lines.reduce((sum, line) => sum + Number(line.totalCost || 0), 0), status: row.status, inRsmi: false, lines };
    });

    const includedRisIds = new Set(rsmiLinks.map((link) => link.ris_id));
    risRecords.forEach((record) => { record.inRsmi = includedRisIds.has(record.dbId); });
    rsmiRecords = rsmiRows.map((row) => {
      let metadata = {};
      try { metadata = JSON.parse(row.remarks || "{}"); } catch { metadata = {}; }
      const classification = metadata.classification || "";
      const linkedIds = rsmiLinks.filter((link) => link.rsmi_id === row.id).map((link) => link.ris_id);
      const linkedRecords = risRecords.filter((record) => linkedIds.includes(record.dbId));
      const value = linkedRecords.reduce((reportTotal, record) => reportTotal + (record.lines || [])
        .filter((line) => !classification || line.rsmiClassification === classification)
        .reduce((lineTotal, line) => lineTotal + (Number(line.totalCost) || Number(line.qty || line.issuedQty || 0) * Number(line.unitCost || 0)), 0), 0);
      return {
        dbId: row.id,
        number: row.rsmi_number,
        classification,
        certifiedBy: metadata.certifiedBy || "",
        certifiedPosition: metadata.certifiedPosition || "",
        certifiedDate: metadata.certifiedDate || "",
        postedBy: metadata.postedBy || "",
        postedPosition: metadata.postedPosition || "",
        postedDate: metadata.postedDate || "",
        from: row.reporting_period_start,
        to: row.reporting_period_end,
        period: `${dateLabel(row.reporting_period_start)} – ${dateLabel(row.reporting_period_end)}`,
        prepared: dateLabel(row.date_prepared),
        ris: linkedRecords.map((record) => record.number),
        risIds: linkedIds,
        value,
        status: row.status
      };
    });
  }

  const options = () => `<option value="">Select item from master data</option>${masters.Items.map((item) => `<option value="${escapeInline(item[1])}">${escapeInline(item[1])}</option>`).join("")}`;
  const escapeInline = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const poItemDisplayName = (generalName, description) => description && description !== generalName ? `${generalName} — ${description}` : generalName;

  function clearPoLineError(row) {
    row.querySelectorAll(".po-field-invalid").forEach((field) => field.classList.remove("po-field-invalid"));
    row.querySelectorAll(".po-line-error").forEach((message) => message.remove());
  }

  function markPoLineError(row, field, message, canAddItem = false) {
    field.classList.add("po-field-invalid");
    const note = document.createElement("small");
    note.className = "po-line-error";
    note.innerHTML = `${escapeInline(message)}${canAddItem ? '<button type="button" data-po-add-master>Add this item to master data</button>' : ""}`;
    field.closest("td")?.appendChild(note);
  }

  function collectPoLines(form, rowsSelector, includeDatabaseIds = false) {
    const rows = [...form.querySelectorAll(`${rowsSelector} tr`)];
    const lines = [];
    let firstError = null;
    rows.forEach((row, index) => {
      clearPoLineError(row);
      const itemSelect = row.querySelector('[name="item"]');
      const uomSelect = row.querySelector('[name="unit"]');
      const itemName = String(itemSelect.value || "");
      const item = refs.items.get(itemName);
      if (!item) {
        const message = `Line ${index + 1} — Item Description: select an item from the Items master list or add it now.`;
        markPoLineError(row, itemSelect, message, true);
        firstError ||= { field: itemSelect, message };
      } else if (String(uomSelect.value || "") !== String(item.unit_of_measure || "")) {
        const message = `Line ${index + 1} — UOM: ${uomSelect.value || "blank"} is not registered for this item. Add it as a new item variant.`;
        markPoLineError(row, uomSelect, message, true);
        firstError ||= { field: uomSelect, message };
      }
      lines.push({
        ...(includeDatabaseIds ? { id: row.dataset.poItemId || null } : {}),
        line_number: index + 1,
        item_id: item?.id,
        item_description: itemName,
        quantity_ordered: Number(row.querySelector(".po-qty").value),
        unit_cost: Number(row.querySelector(".po-cost").value),
      });
    });
    if (firstError) {
      firstError.field.focus();
      showToast(firstError.message, "error");
      return null;
    }
    return lines;
  }

  function openInlinePoItem(form, row) {
    document.querySelector("#po-inline-item-modal")?.remove();
    const itemSelect = row?.querySelector('[name="item"]');
    const uomSelect = row?.querySelector('[name="unit"]');
    const sourceItem = refs.items.get(String(itemSelect?.value || ""));
    const requestedUom = String(uomSelect?.value || sourceItem?.unit_of_measure || "");
    const sourceUacs = [...refs.uacs.values()].find((entry) => entry.id === sourceItem?.default_uacs_account_id);
    const variantDescription = sourceItem
      ? `${sourceItem.description || sourceItem.item_name}${requestedUom && requestedUom !== sourceItem.unit_of_measure ? ` (${requestedUom})` : ""}`
      : "";
    const uacsOptions = classificationSequence.map((classification) => {
      const entries = [...refs.uacs.values()]
        .filter((entry) => entry.active && entry.account_category === classification)
        .sort((a, b) => a.account_title.localeCompare(b.account_title))
        .map((entry) => `<option value="${escapeInline(entry.uacs_code)}" data-classification="${escapeInline(entry.account_category)}" ${entry.id === sourceUacs?.id ? "selected" : ""}>${escapeInline(entry.account_title)} — ${escapeInline(entry.uacs_code)}</option>`)
        .join("");
      return entries ? `<optgroup label="${escapeInline(classification)}">${entries}</optgroup>` : "";
    }).join("");
    const uomOptions = masters.UOM.map((entry) => `<option value="${escapeInline(entry[1])}" ${entry[1] === requestedUom ? "selected" : ""}>${escapeInline(entry[0])} (${escapeInline(entry[1])})</option>`).join("");
    const overlay = document.createElement("div");
    overlay.id = "po-inline-item-modal";
    overlay.className = "po-inline-item-backdrop";
    overlay.innerHTML = `<form class="po-inline-item-dialog" id="po-inline-item-form"><div class="drawer-head"><div><p>Purchase order item assistance</p><h2>Add new item</h2></div><button type="button" id="po-inline-close" aria-label="Close">×</button></div><div class="drawer-body"><p class="po-inline-item-note">The selected UOM is different from the current item master record. Create a separate item variant here; your Purchase Order will remain open.</p><div class="form-grid item-master-form"><label class="wide">UACS Codes<select name="uacs" id="po-inline-uacs" required><option value="">Select a UACS account</option>${uacsOptions}</select></label><label class="wide">General Name<input name="generalName" value="${escapeInline(sourceItem?.item_name || "")}" required></label><label class="wide">Description<textarea name="description" rows="3" required>${escapeInline(variantDescription)}</textarea><small class="field-hint">Use a distinct description for item variants with a different UOM.</small></label><label>UOM<select name="uom" required><option value="">Select UOM</option>${uomOptions}</select></label><label>Re-Order Point<input name="reorderPoint" type="number" min="0" step="0.001" value="${escapeInline(sourceItem?.reorder_level || 0)}" required></label><label class="wide">Item Classification<select id="po-inline-classification" disabled><option value="">Select a UACS account first</option>${classificationSequence.map((classification) => `<option value="${classification}">${classification}</option>`).join("")}</select><small class="field-hint">Automatically determined by the UACS account.</small></label></div><p class="field-error" id="po-inline-item-error" role="alert"></p></div><div class="drawer-foot"><button type="button" class="secondary-button" id="po-inline-cancel">Cancel</button><button class="primary-button">Save item and use in PO</button></div></form>`;
    document.body.appendChild(overlay);
    const inlineForm = overlay.querySelector("#po-inline-item-form");
    const uacsSelect = overlay.querySelector("#po-inline-uacs");
    const classificationSelect = overlay.querySelector("#po-inline-classification");
    const close = () => overlay.remove();
    const syncClassification = () => { classificationSelect.value = uacsSelect.selectedOptions[0]?.dataset.classification || ""; };
    overlay.querySelector("#po-inline-close").onclick = close;
    overlay.querySelector("#po-inline-cancel").onclick = close;
    uacsSelect.onchange = syncClassification;
    syncClassification();
    inlineForm.onsubmit = async (event) => {
      event.preventDefault();
      const data = new FormData(inlineForm);
      const uacs = refs.uacs.get(String(data.get("uacs") || ""));
      const generalName = String(data.get("generalName") || "").trim();
      const description = String(data.get("description") || "").trim();
      const newUom = String(data.get("uom") || "").trim();
      const classification = uacs?.account_category || "";
      const error = overlay.querySelector("#po-inline-item-error");
      const displayName = poItemDisplayName(generalName, description);
      if (!uacs || !classificationSequence.includes(classification)) { error.textContent = "Select an active UACS account with a valid classification."; return; }
      if (!generalName || !description || !newUom) { error.textContent = "General Name, Description, and UOM are required."; return; }
      if (refs.items.has(displayName)) { error.textContent = "An item with this General Name and Description already exists. Use a distinct description for the new UOM variant."; return; }
      try {
        let category = refs.categories.get(classification);
        if (!category) {
          [category] = await api.insert("item_categories", { category_name: classification, description: `System classification for ${classification} items.`, classification_rule: `Always ${classification}`, default_classification: classification, threshold_based_classification_enabled: false, qualifies_as_ppe: classification !== "Expendable", active: true });
        }
        const usedCodes = new Set([...refs.items.values()].map((entry) => String(entry.item_code)));
        let expendableCode = Math.floor(Date.now() / 1000);
        while (usedCodes.has(String(expendableCode))) expendableCode += 1;
        const value = {
          item_code: classification === "Expendable" ? String(expendableCode) : `ITM-${uacs.uacs_code}-${Date.now().toString(36).toUpperCase()}`,
          item_name: generalName,
          description,
          category_id: category.id,
          unit_of_measure: newUom,
          default_uacs_account_id: uacs.id,
          reorder_level: Number(data.get("reorderPoint") || 0),
          default_classification: classification,
          active: true,
        };
        await api.insert("items", value);
        await loadData();
        if (!document.body.contains(form)) return;
        form.querySelectorAll('select[name="item"]').forEach((select) => {
          const previous = select.value;
          select.innerHTML = options();
          if ([...select.options].some((option) => option.value === previous)) select.value = previous;
        });
        if (itemSelect) itemSelect.value = displayName;
        if (uomSelect) uomSelect.value = newUom;
        if (row) clearPoLineError(row);
        close();
        showToast(`${displayName} was added to Items and selected in the Purchase Order.`);
      } catch (reason) {
        error.textContent = reason.message;
      }
    };
  }

  function installPoItemAssistance(form, rowsSelector, addMasterButtonSelector) {
    const rows = form.querySelector(rowsSelector);
    if (!rows) return;
    form.querySelector(addMasterButtonSelector)?.addEventListener("click", () => openInlinePoItem(form, rows.lastElementChild));
    rows.addEventListener("click", (event) => {
      const addButton = event.target.closest("[data-po-add-master]");
      if (addButton) openInlinePoItem(form, addButton.closest("tr"));
    });
    rows.addEventListener("change", (event) => {
      const row = event.target.closest("tr");
      if (!row) return;
      clearPoLineError(row);
      if (event.target.name !== "unit") return;
      const item = refs.items.get(String(row.querySelector('[name="item"]')?.value || ""));
      if (item && String(event.target.value || "") !== String(item.unit_of_measure || "")) {
        markPoLineError(row, event.target, `This UOM is different from the item's master UOM (${item.unit_of_measure}). Add a new item variant to continue.`, true);
        openInlinePoItem(form, row);
      }
    });
  }

  const originalOpenProperty = openPropertyForm;
  openPropertyForm = function connectedOpenProperty(index) {
    originalOpenProperty(index);
    const property = propertyUnits[index];
    if (!property) return;
    const form = document.querySelector("#property-form");
    if (!form) return;
    if(property.classification === "Capital Outlay"){
      form.onsubmit = async (event) => {
        event.preventDefault();
        const data = new FormData(form);
        const error = document.querySelector("#property-error");
        error.textContent = "";
        const employee = refs.employees.get(String(data.get("employee") || ""));
        const receivedFrom = refs.employees.get(String(data.get("receivedFrom") || ""));
        const submitButton = form.querySelector('button[type="submit"], .drawer-foot .primary-button');
        submitButton.disabled = true;
        submitButton.textContent = "Saving…";
        try {
          const parNumber = String(data.get("parNumber") || "").trim().toUpperCase();
          const otherInformation = String(data.get("otherInfo") || "").replace(/\s*\[PAR No\.:\s*[^\]]+\]\s*/ig, " ").trim();
          const storedRemarks = String(property.remarks || "").replace(/\s*\[PAR No\.:\s*[^\]]+\]\s*/ig, " ").trim();
          const updateValues = {
            par_number: parNumber,
            brand: String(data.get("brand") || "").trim() || null,
            model: String(data.get("model") || "").trim() || null,
            serial_number: String(data.get("serial") || "").trim() || null,
            current_status: String(data.get("status") || "Available"),
            condition: String(data.get("condition") || "Serviceable"),
            issued_to_employee_id: employee?.id || null,
            ics_issued_by_employee_id: receivedFrom?.id || null,
            employee_plantilla_position: employee?.plantilla_position || null,
            other_info: otherInformation || null
          };
          try {
            await api.update("property_units", `id=eq.${property.dbId}`, updateValues);
          } catch (saveReason) {
            const missingParColumn=/par_number|schema cache|PGRST204|column.+does not exist/i.test(String(saveReason?.message||saveReason));
            if(!missingParColumn)throw saveReason;
            const {par_number,...compatibleValues}=updateValues;
            compatibleValues.remarks=[storedRemarks,`[PAR No.: ${parNumber}]`].filter(Boolean).join(" ");
            await api.update("property_units", `id=eq.${property.dbId}`, compatibleValues);
          }
          document.querySelector("#modal").innerHTML = "";
          await loadData();
          render("Property Records");
          showToast("Capital-outlay property record and PAR No. saved in Supabase.");
        } catch (reason) {
          error.textContent = reason.message;
          submitButton.disabled = false;
          submitButton.textContent = "Save property record";
        }
      };
      return;
    }
    if(property.classification !== "Semi-Expendable")return;
    form.onsubmit = async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const generateIcs = event.submitter?.value === "generate";
      const error = document.querySelector("#property-error");
      error.textContent = "";
      const issuedTo = refs.employees.get(String(data.get("employee") || ""));
      const issuedBy = refs.employees.get(String(data.get("issuedBy") || ""));
      if (!issuedTo || !issuedBy) {
        error.textContent = "Issued to / Received by and Issued by are required.";
        return;
      }
      const buttons = [...form.querySelectorAll('button[type="submit"]')];
      buttons.forEach(button => { button.disabled = true; });
      if (event.submitter) event.submitter.textContent = generateIcs ? "Generating…" : "Saving…";
      try {
        await api.rpc("issue_semi_expendable_property", {
          p_property_id: property.dbId,
          p_employee_id: issuedTo.id,
          p_issued_by_employee_id: issuedBy.id,
          p_generate_ics: generateIcs,
          p_ics_number: String(data.get("icsNumber") || "").trim().toUpperCase(),
          p_inventory_item_number: String(data.get("inventoryNumber") || "").trim().toUpperCase(),
          p_ppe_number: String(data.get("ppeNumber") || "").trim().toUpperCase(),
          p_other_info: String(data.get("otherInfo") || "").trim(),
          p_brand: String(data.get("brand") || "").trim(),
          p_model: String(data.get("model") || "").trim(),
          p_serial_number: String(data.get("serial") || "").trim(),
          p_condition: String(data.get("condition") || "Good"),
          p_performed_by: api.session?.user?.email || "Signed-in user",
        });
        document.querySelector("#modal").innerHTML = "";
        await loadData();
        render("Property Records");
        showToast(generateIcs ? `${property.icsNumber ? "ICS updated" : "ICS and Inventory numbers generated"} in Supabase.` : "Changes saved without consuming an ICS sequence.");
      } catch (reason) {
        error.textContent = reason.message;
        buttons.forEach(button => { button.disabled = false; });
        const saveButton=form.querySelector('button[value="save"]');
        const generateButton=form.querySelector('button[value="generate"]');
        if(saveButton)saveButton.textContent="Save changes";
        if(generateButton)generateButton.textContent=property.icsNumber?"Update ICS":"Generate ICS";
      }
    };
  };

  markPropertyUnserviceable = async function connectedMarkPropertyUnserviceable(index) {
    const property = propertyUnits[index];
    if (!property?.dbId || property.status === "Unserviceable") return;
    const identifier = property.inventoryNumber || property.number || property.item;
    if (!confirm(`Mark ${identifier} as unserviceable?`)) return;
    try {
      await api.update("property_units", `id=eq.${property.dbId}`, {
        current_status: "Unserviceable",
        condition: "Unserviceable",
        performed_by: api.session?.user?.email || "Signed-in user"
      });
      await loadData();
      render("Property Records");
      showToast(`${identifier} marked as unserviceable in Supabase.`);
    } catch (error) {
      showToast(`Could not update ${identifier}: ${error.message}`, "error");
    }
  };

  const originalOpenPO = openPO;
  openPO = function connectedOpenPO() {
    originalOpenPO();
    document.querySelectorAll('#po-item-rows select[name="item"]').forEach((select) => { select.innerHTML = options(); });
    document.querySelector("#add-po-item")?.addEventListener("click", () => {
      const select = document.querySelector('#po-item-rows tr:last-child select[name="item"]');
      if (select) select.innerHTML = options();
    });
    const form = document.querySelector("#po-form");
    if (!form) return;
    form.noValidate = true;
    installPoItemAssistance(form, "#po-item-rows", "#add-po-master-item");
    form.onsubmit = async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const number = String(data.get("number") || "").trim();
      const date = String(data.get("date") || "");
      const supplier = refs.suppliers.get(String(data.get("supplier") || ""));
      if (!number || !date || !supplier) return showToast("PO number, PO date, and supplier are required.", "error");
      const lines = collectPoLines(form, "#po-item-rows");
      if (!lines) return;
      try {
        const [created] = await api.insert("purchase_orders", { po_number: number, po_date: date, supplier_id: supplier.id, supplier_address: supplier.address, purchase_request_number: String(data.get("pr") || "").trim() || null, mode_of_procurement: String(data.get("mode") || ""), purpose: String(data.get("purpose") || "").trim() || null, delivery_location: "3rd Floor Esquina Dos Bldg, J.C. Aquino Ave, Butuan City", delivery_period: String(data.get("deliveryPeriod") || ""), fund_source: "Regular Fund 01", status: event.submitter?.value === "approve" ? "Completed" : "Draft", performed_by: api.session?.user?.email || "Signed-in user" });
        await api.insert("purchase_order_items", lines.map((line) => ({ ...line, purchase_order_id: created.id })));
        document.querySelector("#modal").innerHTML = "";
        await loadData();
        render("Purchase Orders");
        showToast(`${number} saved to Supabase.`);
      } catch (error) { showToast(error.message, "error"); }
    };
  };

  const originalOpenPOEdit = openPOEdit;
  openPOEdit = function connectedOpenPOEdit(index) {
    const record = pos[index];
    originalOpenPOEdit(index);
    if (!record?.dbId) return;
    const form = document.querySelector("#po-edit-form");
    if (!form) return;
    form.noValidate = true;
    installPoItemAssistance(form, "#edit-po-item-rows", "#add-edit-po-master-item");
    form.onsubmit = async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const supplier = refs.suppliers.get(String(data.get("supplier") || ""));
      if (!supplier) return showToast("Select a supplier from the supplier master list.", "error");
      const lines = collectPoLines(form, "#edit-po-item-rows", true);
      if (!lines) return;
      try {
        await api.update("purchase_orders", `id=eq.${record.dbId}`, {
          po_number: String(data.get("number") || "").trim(),
          po_date: String(data.get("date") || ""),
          supplier_id: supplier.id,
          supplier_address: supplier.address,
          purchase_request_number: String(data.get("pr") || "").trim() || null,
          mode_of_procurement: String(data.get("mode") || "").trim(),
          purpose: String(data.get("purpose") || "").trim() || null,
          delivery_location: "3rd Floor Esquina Dos Bldg, J.C. Aquino Ave, Butuan City",
          delivery_period: String(data.get("deliveryPeriod") || ""),
          fund_source: "Regular Fund 01",
          status: event.submitter?.value === "approve" ? "Completed" : "Draft",
          performed_by: api.session?.user?.email || "Signed-in user",
        });
        const submittedIds = new Set(lines.map((line) => line.id).filter(Boolean));
        for (const existingLine of record[8] || []) {
          if (existingLine.dbId && !submittedIds.has(existingLine.dbId)) await api.remove("purchase_order_items", `id=eq.${existingLine.dbId}`);
        }
        for (const line of lines.filter((entry) => entry.id)) {
          await api.update("purchase_order_items", `id=eq.${line.id}`, { line_number: line.line_number, item_id: line.item_id, item_description: line.item_description, quantity_ordered: line.quantity_ordered, unit_cost: line.unit_cost });
        }
        const newLines = lines.filter((entry) => !entry.id).map(({ id, ...line }) => ({ ...line, purchase_order_id: record.dbId }));
        if (newLines.length) await api.insert("purchase_order_items", newLines);
        document.querySelector("#modal").innerHTML = "";
        await loadData();
        render("Purchase Orders");
        showToast(event.submitter?.value === "approve" ? "Purchase order updated and approved in Supabase." : "Purchase order draft updated in Supabase.");
      } catch (error) { showToast(error.message, "error"); }
    };
  };

  const originalUnpostPO = unpostPO;
  unpostPO = async function connectedUnpostPO(index) {
    const record = pos[index];
    if (!record?.dbId) return originalUnpostPO(index);
    if (record[6] !== "Completed") { showToast("Only a completed purchase order can be unposted.", "error"); return; }
    const linkedIar = iars.find((iar) => iar[1] === record[0]);
    if (linkedIar) { showToast(`Delete ${linkedIar[0]} before unposting ${record[0]}.`, "error"); return; }
    if (!confirm(`Unpost ${record[0]} and return it to Draft?`)) return;
    try {
      await api.update("purchase_orders", `id=eq.${record.dbId}`, { status: "Draft", performed_by: api.session?.user?.email || "Signed-in user" });
      await loadData();
      render("Purchase Orders");
      showToast(`${record[0]} unposted and returned to Draft.`);
    } catch (error) { showToast(`Could not unpost ${record[0]}: ${error.message}`, "error"); }
  };

  const originalOpenIAR = openIARForm;
  openIARForm = function connectedOpenIAR(index) {
    const po = pos[index];
    if (!po?.dbId) return originalOpenIAR(index);
    originalOpenIAR(index);
    const form = document.querySelector("#iar-create-form");
    if (!form) return;
    form.onsubmit = async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      try {
        const [created] = await api.insert("inspection_acceptance_reports", { iar_number: String(data.get("number")).trim(), iar_date: String(data.get("date")), invoice_number: String(data.get("invoiceNumber") || "").trim() || null, invoice_date: String(data.get("invoiceDate") || "") || null, purchase_order_id: po.dbId, status: "Draft", performed_by: api.session?.user?.email || "Signed-in user" });
        await api.insert("inspection_acceptance_items", (po[8] || []).map((line) => ({ iar_id: created.id, purchase_order_item_id: line.dbId, quantity_delivered: line.qty, quantity_inspected: line.qty, quantity_accepted: line.qty, quantity_rejected: 0, condition: "Good" })));
        document.querySelector("#modal").innerHTML = "";
        await loadData();
        render("Inspection & Acceptance");
        showToast(`${created.iar_number} saved to Supabase.`);
      } catch (error) { showToast(error.message, "error"); }
    };
  };

  const originalDeleteIAR = deleteIAR;
  deleteIAR = async function connectedDeleteIAR(index) {
    const record = iars[index];
    if (!record?.dbId) return originalDeleteIAR(index);
    if (record[6] === "Completed") { showToast("Unpost the completed IAR before deleting it.", "error"); return; }
    if (!confirm(`Delete ${record[0]}?`)) return;
    try {
      await api.remove("inspection_acceptance_reports", `id=eq.${record.dbId}`);
      await loadData();
      render("Inspection & Acceptance");
      showToast(`${record[0]} deleted from Supabase.`);
    } catch (error) { showToast(error.message, "error"); }
  };

  const originalUnpostIAR = unpostIAR;
  unpostIAR = async function connectedUnpostIAR(index) {
    const record = iars[index];
    if (!record?.dbId) return originalUnpostIAR(index);
    if (record[6] !== "Completed") return;
    try {
      const lines = await api.select("inspection_acceptance_items", `iar_id=eq.${record.dbId}&select=id`);
      const batches = [];
      const units = [];
      for (const line of lines) {
        batches.push(...await api.select("inventory_batches", `source_iar_item_id=eq.${line.id}&select=id,quantity_received,quantity_remaining,status`));
        units.push(...await api.select("property_units", `source_iar_item_id=eq.${line.id}&select=id,current_status,property_number,serial_number,issued_to_employee_id,office_id,current_location`));
      }
      for (const batch of batches) {
        const allocations = await api.select("ris_batch_allocations", `inventory_batch_id=eq.${batch.id}&select=id`);
        if (allocations.length || Number(batch.quantity_remaining) !== Number(batch.quantity_received)) {
          showToast("This IAR cannot be unposted because some of its received stock has already been issued through an RIS. Unpost the related RIS first.", "error");
          return;
        }
      }
      const changedUnit = units.find((unit) => unit.current_status !== "Available" || unit.property_number || unit.serial_number || unit.issued_to_employee_id || unit.office_id || unit.current_location);
      if (changedUnit) {
        showToast("This IAR cannot be unposted because one of its property units has already been identified, assigned, or moved.", "error");
        return;
      }
      if (!confirm(`Unpost ${record[0]}? Its inventory or property receipts will be removed and the IAR will return to Draft status.`)) return;
      await api.remove("stock_movements", `reference_document=eq.IAR&reference_number=eq.${encodeURIComponent(record[0])}`);
      for (const batch of batches) await api.remove("inventory_batches", `id=eq.${batch.id}`);
      for (const unit of units) await api.remove("property_units", `id=eq.${unit.id}`);
      for (const line of lines) await api.update("inspection_acceptance_items", `id=eq.${line.id}`, { processed_at: null, system_classification: null, final_classification: null, classification_override_reason: null });
      await api.update("inspection_acceptance_reports", `id=eq.${record.dbId}`, { status: "Draft", completed_at: null, performed_by: api.session?.user?.email || "Signed-in user" });
      await loadData();
      render("Inspection & Acceptance");
      showToast(`${record[0]} unposted. Its inventory receipt was reversed.`);
    } catch (error) { showToast(`Could not unpost ${record[0]}: ${error.message}`, "error"); }
  };

  const originalBindEnhanced = bindEnhanced;
  bindEnhanced = function connectedBindEnhanced() {
    originalBindEnhanced();
    document.querySelectorAll("[data-process]").forEach((button) => {
      button.onclick = async () => {
        const record = iars[Number(button.dataset.process)];
        if (!record?.dbId) return;
        const propertyCount=(record[7]||[]).filter(line=>line.classification==="Semi-Expendable"||line.classification==="Capital Outlay").reduce((sum,line)=>sum+Number(line.qty||0),0);
        if (!confirm(`Complete and approve ${record[0]}? Consolidated Semi-Expendable and Capital Outlay quantities will be split into ${propertyCount} individual 1:1 property unit${propertyCount===1?"":"s"}. Expendables will be posted as inventory batches.`)) return;
        button.disabled = true;
        button.textContent = "Processing…";
        try {
          await api.rpc("complete_iar", { p_iar_id: record.dbId, p_performed_by: api.session?.user?.email || "Signed-in user" });
          await loadData();
          render("Inspection & Acceptance");
          showToast(`${record[0]} completed. ${propertyCount} individual property unit${propertyCount===1?" was":"s were"} created for 1:1 issuance; expendables were posted to inventory.`);
        } catch (error) {
          button.disabled = false;
          button.textContent = "Complete & process";
          showToast(error.message, "error");
        }
      };
    });
  };

  const originalOpenRIS = openRISForm;
  openRISForm = function connectedOpenRIS() {
    originalOpenRIS();
    const form = document.querySelector("#ris-form");
    if (!form) return;
    const officeSelect = form.querySelector('[name="office"]');
    const employeeSelect = form.querySelector('[name="requested"]');
    const approvedSelect = form.querySelector('[name="approved"]');
    const issuedSelect = form.querySelector('[name="issued"]');
    const receivedSelect = form.querySelector('[name="received"]');
    officeSelect.innerHTML = `<option value="">Select office</option>${[...refs.offices.keys()].map((name) => `<option>${name}</option>`).join("")}`;
    const employeeOptions = `<option value="">Select employee</option>${[...refs.employees.keys()].sort((a, b) => a.localeCompare(b)).map((name) => `<option>${name}</option>`).join("")}`;
    employeeSelect.innerHTML = employeeOptions;
    approvedSelect.innerHTML = employeeOptions;
    issuedSelect.innerHTML = employeeOptions;
    receivedSelect.innerHTML = employeeOptions;
    form.onsubmit = async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const office = refs.offices.get(String(data.get("office")));
      const employee = refs.employees.get(String(data.get("requested")));
      const intent = String(data.get("intent") || "draft");
      const lines = collectRisLineEntries(form, intent);
      const number = String(data.get("number") || "").trim();
      const errorDisplay = document.querySelector("#ris-error");
      const fail = (message) => {
        errorDisplay.textContent = message;
        errorDisplay.scrollIntoView({ behavior: "smooth", block: "center" });
        showToast(message, "error");
      };
      if (!/^\d{4}-(0[1-9]|1[0-2])-\d{4}$/.test(number)) {
        fail("RIS number must follow YYYY-MM-xxxx, for example 2026-08-0001.");
        return;
      }
      if (risRecords.some((record) => record.number === number)) {
        fail("RIS number already exists.");
        return;
      }
      if (!String(data.get("date") || "")) {
        fail("Enter the RIS date.");
        return;
      }
      if (!office) {
        fail("Select the requesting office.");
        return;
      }
      if (!employee) {
        fail("Select the employee under Requested by.");
        return;
      }
      if (!lines?.length) return;
      if (intent === "approve" && !String(data.get("approved") || "")) {
        fail("Select the approving employee before approving this RIS.");
        return;
      }
      const actionButton = document.querySelector(intent === "approve" ? "#approve-ris" : "#save-ris-draft");
      const originalButtonText = actionButton.textContent;
      actionButton.disabled = true;
      actionButton.textContent = intent === "approve" ? "Approving…" : "Saving…";
      let created = null;
      try {
        [created] = await api.insert("requisition_issue_slips", { ris_number: number, ris_date: String(data.get("date")), requesting_office_id: office.id, purpose: String(data.get("purpose") || ""), requested_by_employee_id: employee.id, approved_by: String(data.get("approved") || ""), issued_by: String(data.get("issued") || ""), received_by: String(data.get("received") || ""), remarks: String(data.get("remarks") || ""), status: "Draft", performed_by: api.session?.user?.email || "Signed-in user" });
        await api.insert("requisition_issue_slip_items", lines.map((line, index) => ({ ris_id: created.id, line_number: index + 1, item_id: line.itemId, quantity_requested: line.qty, quantity_issued: line.qty, remarks: JSON.stringify({ userRemarks: line.remarks, selectedBatchId: line.batchId }) })));
        if (intent === "approve") await api.rpc("complete_ris", { p_ris_id: created.id, p_performed_by: api.session?.user?.email || "Signed-in user" });
        document.querySelector("#modal").innerHTML = "";
        await loadData();
        render("Requisition & Issue Slips");
        showToast(intent === "approve" ? `${created.ris_number} approved and posted to inventory.` : `${created.ris_number} saved as a draft.`);
      } catch (error) {
        if (created) {
          document.querySelector("#modal").innerHTML = "";
          await loadData();
          render("Requisition & Issue Slips");
          showToast(`${created.ris_number} was saved as a draft, but approval failed: ${error.message}`, "error");
        } else {
          actionButton.disabled = false;
          actionButton.textContent = originalButtonText;
          fail(`Supabase could not save this RIS: ${error.message}`);
        }
      }
    };
  };

  const originalCompleteRIS = openCompleteRIS;
  openCompleteRIS = function connectedCompleteRIS(index) {
    const record = risRecords[index];
    if (!record?.dbId) return originalCompleteRIS(index);
    originalCompleteRIS(index);
    const form = document.querySelector("#complete-ris-form");
    if (!form) return;
    form.onsubmit = async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      try {
        await api.rpc("complete_ris", { p_ris_id: record.dbId, p_performed_by: String(data.get("performed") || api.session?.user?.email || "Signed-in user") });
        document.querySelector("#modal").innerHTML = "";
        await loadData();
        render("Requisition & Issue Slips");
        showToast(`${record.number} completed and posted to inventory.`);
      } catch (error) { showToast(error.message, "error"); }
    };
  };

  const originalEditRIS = openRISEdit;
  openRISEdit = function connectedEditRIS(index) {
    const record = risRecords[index];
    if (!record?.dbId) return originalEditRIS(index);
    originalEditRIS(index);
    const form = document.querySelector("#ris-form");
    if (!form) return;
    form.onsubmit = async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const office = refs.offices.get(String(data.get("office")));
      const employee = refs.employees.get(String(data.get("requested")));
      const lines = collectRisLineEntries(form, "draft");
      const number = String(data.get("number") || "").trim();
      const error = document.querySelector("#ris-error");
      const fail = (message) => { error.textContent = message; showToast(message, "error"); };
      if (!/^\d{4}-(0[1-9]|1[0-2])-\d{4}$/.test(number)) return fail("RIS number must follow YYYY-MM-xxxx.");
      if (risRecords.some((other) => other.dbId !== record.dbId && other.number === number)) return fail("RIS number already exists.");
      if (!office || !employee) return fail("Complete the requesting office and Requested by fields.");
      if (!lines?.length) return;
      const save = document.querySelector("#save-ris-draft");
      save.disabled = true;
      save.textContent = "Saving…";
      try {
        await api.update("requisition_issue_slips", `id=eq.${record.dbId}`, { ris_number: number, ris_date: String(data.get("date")), requesting_office_id: office.id, purpose: String(data.get("purpose") || ""), requested_by_employee_id: employee.id, approved_by: String(data.get("approved") || ""), issued_by: String(data.get("issued") || ""), received_by: String(data.get("received") || ""), remarks: String(data.get("remarks") || ""), performed_by: api.session?.user?.email || "Signed-in user" });
        const submittedIds = new Set(lines.map((line) => line.dbId).filter(Boolean));
        for (const existingLine of record.lines || []) {
          if (existingLine.dbId && !submittedIds.has(existingLine.dbId)) await api.remove("requisition_issue_slip_items", `id=eq.${existingLine.dbId}`);
        }
        for (const [lineIndex, line] of lines.entries()) {
          const value = { line_number: lineIndex + 1, item_id: line.itemId, quantity_requested: line.qty, quantity_issued: line.qty, remarks: JSON.stringify({ userRemarks: line.remarks, selectedBatchId: line.batchId }) };
          if (line.dbId) await api.update("requisition_issue_slip_items", `id=eq.${line.dbId}`, value);
          else await api.insert("requisition_issue_slip_items", { ris_id: record.dbId, ...value });
        }
        document.querySelector("#modal").innerHTML = "";
        await loadData();
        render("Requisition & Issue Slips");
        showToast(`${number} updated.`);
      } catch (saveError) {
        save.disabled = false;
        save.textContent = "Save Changes";
        fail(saveError.message);
      }
    };
  };

  generateRsmi = async function connectedGenerateRsmi() {
    const classification = document.querySelector("#rsmi-classification")?.value || "";
    const from = document.querySelector("#rsmi-from")?.value || "";
    const to = document.querySelector("#rsmi-to")?.value || "";
    const number = document.querySelector("#rsmi-number")?.value.trim() || "";
    const certifiedBy = document.querySelector("#rsmi-certified-by")?.value || "";
    const certifiedDate = document.querySelector("#rsmi-certified-date")?.value || "";
    const postedBy = document.querySelector("#rsmi-posted-by")?.value || "";
    const postedDate = document.querySelector("#rsmi-posted-date")?.value || "";
    if (!classification) { showToast("Select an RSMI classification.", "error"); return; }
    if (!from || !to || from > to) { showToast("Enter a valid From and To date range.", "error"); return; }
    if (!/^\d{4}-\d{3}$/.test(number)) { showToast("RSMI number must follow YYYY-XXX.", "error"); return; }
    if (!certifiedBy || !postedBy) { showToast("Select both RSMI signatories.", "error"); return; }
    if (!certifiedDate || !postedDate) { showToast("Enter both signatory dates manually.", "error"); return; }
    if (rsmiRecords.some((record) => record.number === number)) { showToast("RSMI number already exists.", "error"); return; }
    const matches = rsmiMatchingRecords(classification, from, to).filter((record) => record.dbId);
    if (!matches.length) { showToast("No completed RIS matches the selected classification and date range.", "error"); return; }
    if (!confirm(`Finalize ${number} for ${classification} with ${matches.length} automatically selected RIS record${matches.length === 1 ? "" : "s"}?`)) return;
    const button = document.querySelector("#generate-rsmi");
    const originalText = button?.textContent || "Generate and finalize RSMI";
    if (button) { button.disabled = true; button.textContent = "Generating…"; }
    let created = null;
    try {
      const today = new Date().toISOString().slice(0, 10);
      [created] = await api.insert("rsmi_reports", {
        rsmi_number: number,
        reporting_period_start: from,
        reporting_period_end: to,
        date_prepared: today,
        status: "Draft",
        prepared_by: certifiedBy,
        performed_by: api.session?.user?.email || "Signed-in user",
        remarks: JSON.stringify({
          classification,
          certifiedBy,
          certifiedPosition: rsmiEmployeePosition(certifiedBy),
          certifiedDate,
          postedBy,
          postedPosition: rsmiEmployeePosition(postedBy),
          postedDate
        })
      });
      await api.rpc("finalize_rsmi", {
        p_rsmi_id: created.id,
        p_ris_ids: matches.map((record) => record.dbId),
        p_performed_by: api.session?.user?.email || "Signed-in user"
      });
      await loadData();
      render("RSMI Generation");
      showToast(`${number} finalized with ${matches.length} automatically selected RIS record${matches.length === 1 ? "" : "s"}.`);
    } catch (error) {
      if (created?.id) {
        try { await api.remove("rsmi_reports", `id=eq.${created.id}`); } catch {}
      }
      if (button) { button.disabled = false; button.textContent = originalText; }
      showToast(`Could not generate ${number}: ${error.message}`, "error");
    }
  };

  unpostRIS = async function connectedUnpostRIS(index) {
    const record = risRecords[index];
    if (!record?.dbId || record.status !== "Completed") return;
    try {
      const rsmiLinks = await api.select("rsmi_ris_records", `ris_id=eq.${record.dbId}&select=id`);
      if (rsmiLinks.length) { showToast("Remove this RIS from its RSMI before unposting.", "error"); return; }
      if (!confirm(`Unpost ${record.number}? Its inventory issue will be reversed and the RIS will return to Draft status.`)) return;
      const items = await api.select("requisition_issue_slip_items", `ris_id=eq.${record.dbId}&select=id,item_id`);
      for (const line of items) {
        const allocations = await api.select("ris_batch_allocations", `ris_item_id=eq.${line.id}&select=id,inventory_batch_id,quantity`);
        for (const allocation of allocations) {
          const [batch] = await api.select("inventory_batches", `id=eq.${allocation.inventory_batch_id}&select=id,quantity_remaining`);
          if (batch) await api.update("inventory_batches", `id=eq.${batch.id}`, { quantity_remaining: Number(batch.quantity_remaining) + Number(allocation.quantity), status: "Open" });
        }
        await api.remove("ris_batch_allocations", `ris_item_id=eq.${line.id}`);
        await api.update("requisition_issue_slip_items", `id=eq.${line.id}`, { processed_at: null });
      }
      await api.remove("stock_movements", `reference_document=eq.RIS&reference_number=eq.${encodeURIComponent(record.number)}`);
      await api.update("requisition_issue_slips", `id=eq.${record.dbId}`, { status: "Draft", completed_at: null, performed_by: api.session?.user?.email || "Signed-in user" });
      await loadData();
      render("Requisition & Issue Slips");
      showToast(`${record.number} unposted. You can now edit or delete it.`);
    } catch (error) { showToast(`Could not unpost ${record.number}: ${error.message}`, "error"); }
  };

  deleteRIS = async function connectedDeleteRIS(index) {
    const record = risRecords[index];
    if (!record?.dbId || record.status !== "Draft") return;
    if (!confirm(`Delete draft ${record.number}?`)) return;
    try {
      await api.remove("requisition_issue_slips", `id=eq.${record.dbId}`);
      await loadData();
      render("Requisition & Issue Slips");
      showToast(`${record.number} deleted.`);
    } catch (error) { showToast(`Could not delete ${record.number}: ${error.message}`, "error"); }
  };

  const originalOpenMaster = openMasterForm;
  openMasterForm = function connectedOpenMaster(tab, index = null) {
    if (tab === "Suppliers") {
      const existing = index === null ? null : masters.Suppliers[index];
      const stored = existing ? refs.suppliers.get(existing[0]) : null;
      const organizationType = existing?.[2] || "Non-government";
      document.querySelector("#modal").innerHTML = `<div class="modal-backdrop"><form class="drawer compact-drawer" id="supplier-form"><div class="drawer-head"><div><p>Supplier master data</p><h2>${existing ? "Edit" : "Add"} Supplier</h2></div><button type="button" id="close">×</button></div><div class="drawer-body"><div class="form-grid single-column-form">
        <label>Name<input name="name" value="${existing?.[0] || ""}" required></label>
        <label>Address<textarea name="address" rows="3" required>${existing?.[1] || ""}</textarea></label>
        <label>Organization Type<select name="organizationType" id="supplier-organization" required><option ${organizationType === "Non-government" ? "selected" : ""}>Non-government</option><option ${organizationType === "Government" ? "selected" : ""}>Government</option></select></label>
        <div id="supplier-tax-fields" class="conditional-fields">
          <label>TIN No.<input name="tin" value="${existing?.[3] || ""}"></label>
          <label>Tax Type<select name="taxType"><option value="">Select tax type</option><option ${existing?.[4] === "VAT" ? "selected" : ""}>VAT</option><option ${existing?.[4] === "Non-VAT" ? "selected" : ""}>Non-VAT</option></select></label>
        </div>
      </div><p class="field-error" id="supplier-error"></p></div><div class="drawer-foot"><button type="button" class="secondary-button" id="cancel">Cancel</button><button class="primary-button">Save supplier</button></div></form></div>`;
      const close = () => { document.querySelector("#modal").innerHTML = ""; };
      const organization = document.querySelector("#supplier-organization");
      const taxFields = document.querySelector("#supplier-tax-fields");
      const syncSupplierType = () => {
        const required = organization.value === "Non-government";
        taxFields.hidden = !required;
        taxFields.querySelectorAll("input, select").forEach((field) => { field.required = required; });
      };
      document.querySelector("#close").onclick = close;
      document.querySelector("#cancel").onclick = close;
      organization.onchange = syncSupplierType;
      syncSupplierType();
      document.querySelector("#supplier-form").onsubmit = async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const type = String(data.get("organizationType"));
        const tin = type === "Non-government" ? String(data.get("tin") || "").trim() : null;
        const taxType = type === "Non-government" ? String(data.get("taxType") || "") : "";
        if (type === "Non-government" && (!tin || !taxType)) {
          document.querySelector("#supplier-error").textContent = "TIN No. and Tax Type are required for a non-government supplier.";
          return;
        }
        const value = {
          supplier_name: String(data.get("name") || "").trim(),
          address: String(data.get("address") || "").trim(),
          contact_person: null,
          contact_number: null,
          tax_identification_number: tin,
          status: "Active",
          remarks: JSON.stringify({ organizationType: type, taxType }),
        };
        try {
          if (stored) await api.update("suppliers", `id=eq.${stored.id}`, value);
          else await api.insert("suppliers", value);
          close();
          await loadData();
          adminTab = "Suppliers";
          render("Admin Options");
          showToast(`Supplier ${existing ? "updated" : "saved"} in Supabase.`);
        } catch (error) {
          document.querySelector("#supplier-error").textContent = error.message;
        }
      };
      return;
    }

    if (tab === "Employees") {
      const existing = index === null ? null : masters.Employees[index];
      const stored = existing ? refs.employees.get(existing[1]) : null;
      const availablePositions = masters.Plantilla
        .filter((row) => row[1] === "Active" || row[0] === existing?.[2])
        .map((row) => row[0]);
      document.querySelector("#modal").innerHTML = `<div class="modal-backdrop"><form class="drawer compact-drawer" id="employee-form"><div class="drawer-head"><div><p>Employee master data</p><h2>${existing ? "Edit" : "Add"} Employee</h2></div><button type="button" id="close">×</button></div><div class="drawer-body"><div class="form-grid single-column-form">
        <label>Employee Name<input name="name" value="${existing?.[1] || ""}" required></label>
        <label>Position<select name="position" required><option value="">Select Plantilla position</option>${availablePositions.map((position) => `<option value="${escapeInline(position)}" ${position === existing?.[2] ? "selected" : ""}>${escapeInline(position)}</option>`).join("")}</select><small class="field-hint">Positions are maintained under Admin Options → Plantilla.</small></label>
      </div><p class="field-error" id="employee-error"></p></div><div class="drawer-foot"><button type="button" class="secondary-button" id="cancel">Cancel</button><button class="primary-button">Save employee</button></div></form></div>`;
      const close = () => { document.querySelector("#modal").innerHTML = ""; };
      document.querySelector("#close").onclick = close;
      document.querySelector("#cancel").onclick = close;
      document.querySelector("#employee-form").onsubmit = async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const defaultDepartment = refs.offices.get("FAD");
        const value = {
          employee_number: stored?.employee_number || `EMP-${Date.now().toString(36).toUpperCase()}`,
          full_name: String(data.get("name") || "").trim(),
          plantilla_position: String(data.get("position") || "").trim(),
          office_id: stored?.office_id || defaultDepartment?.id,
          employment_status: stored?.employment_status || "Active",
          active: true,
        };
        try {
          if (!value.office_id) throw new Error("The FAD department could not be prepared. Reload the page and try again.");
          if (stored) await api.update("employees", `id=eq.${stored.id}`, value);
          else await api.insert("employees", value);
          close();
          await loadData();
          adminTab = "Employees";
          render("Admin Options");
          showToast(`Employee ${existing ? "updated" : "saved"} in Supabase.`);
        } catch (error) {
          document.querySelector("#employee-error").textContent = error.message;
        }
      };
      return;
    }

    if (tab === "Plantilla") {
      const existing = index === null ? null : masters.Plantilla[index];
      const stored = existing ? refs.plantilla.get(existing[0]) : null;
      document.querySelector("#modal").innerHTML = `<div class="modal-backdrop"><form class="drawer compact-drawer" id="plantilla-form"><div class="drawer-head"><div><p>Plantilla master data</p><h2>${existing ? "Edit" : "Add"} Position</h2></div><button type="button" id="close">×</button></div><div class="drawer-body"><div class="form-grid single-column-form">
        <label>Position<input name="name" value="${escapeInline(existing?.[0] || "")}" placeholder="e.g. Administrative Officer I" required></label>
        <label>Status<select name="status"><option ${existing?.[1] !== "Inactive" ? "selected" : ""}>Active</option><option ${existing?.[1] === "Inactive" ? "selected" : ""}>Inactive</option></select></label>
      </div><p class="field-error" id="plantilla-error"></p></div><div class="drawer-foot"><button type="button" class="secondary-button" id="cancel">Cancel</button><button class="primary-button">Save position</button></div></form></div>`;
      const close = () => { document.querySelector("#modal").innerHTML = ""; };
      document.querySelector("#close").onclick = close;
      document.querySelector("#cancel").onclick = close;
      document.querySelector("#plantilla-form").onsubmit = async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const name = String(data.get("name") || "").trim();
        const error = document.querySelector("#plantilla-error");
        const duplicate = [...refs.plantilla.keys()].some((value) => value.toLowerCase() === name.toLowerCase() && value !== existing?.[0]);
        if (!name) { error.textContent = "Position is required."; return; }
        if (duplicate) { error.textContent = "This Plantilla position already exists."; return; }
        const value = {
          text_value: name,
          json_value: { active: data.get("status") === "Active" },
          description: "Employee Plantilla position",
        };
        try {
          if (stored) {
            await api.update("system_settings", `setting_key=eq.${encodeURIComponent(stored.setting_key)}`, value);
            if (name !== existing[0]) {
              await api.update("employees", `plantilla_position=eq.${encodeURIComponent(existing[0])}`, { plantilla_position: name });
            }
          } else {
            await api.insert("system_settings", { setting_key: `plantilla_position:${crypto.randomUUID()}`, ...value });
          }
          close();
          await loadData();
          adminTab = "Plantilla";
          render("Admin Options");
          showToast(`Plantilla position ${existing ? "updated" : "saved"} in Supabase.`);
        } catch (reason) {
          error.textContent = reason.message;
        }
      };
      return;
    }

    if (tab === "UOM") {
      const existing = index === null ? null : masters.UOM[index];
      const stored = existing ? refs.uoms.get(existing[0]) : null;
      document.querySelector("#modal").innerHTML = `<div class="modal-backdrop"><form class="drawer compact-drawer" id="uom-form"><div class="drawer-head"><div><p>Unit of measure</p><h2>${existing ? "Edit" : "Add"} UOM</h2></div><button type="button" id="close">×</button></div><div class="drawer-body"><div class="form-grid single-column-form">
        <label>Name<input name="name" value="${existing?.[0] || ""}" placeholder="e.g. Piece" required></label>
        <label>Abbreviation<input name="abbreviation" value="${existing?.[1] || ""}" placeholder="e.g. pc" required></label>
      </div><p class="field-error" id="uom-error"></p></div><div class="drawer-foot"><button type="button" class="secondary-button" id="cancel">Cancel</button><button class="primary-button">Save UOM</button></div></form></div>`;
      const close = () => { document.querySelector("#modal").innerHTML = ""; };
      document.querySelector("#close").onclick = close;
      document.querySelector("#cancel").onclick = close;
      document.querySelector("#uom-form").onsubmit = async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const value = {
          text_value: String(data.get("abbreviation") || "").trim(),
          json_value: { name: String(data.get("name") || "").trim() },
          description: "Inventory unit of measure",
        };
        try {
          if (stored) await api.update("system_settings", `setting_key=eq.${encodeURIComponent(stored.setting_key)}`, value);
          else await api.insert("system_settings", { setting_key: `uom:${crypto.randomUUID()}`, ...value });
          close();
          await loadData();
          adminTab = "UOM";
          render("Admin Options");
          showToast(`UOM ${existing ? "updated" : "saved"} in Supabase.`);
        } catch (error) {
          document.querySelector("#uom-error").textContent = error.message;
        }
      };
      return;
    }

    if (tab === "Procurement Modes") {
      const existing = index === null ? null : masters.ProcurementModes[index];
      const stored = existing ? refs.procurementModes.get(existing[0]) : null;
      document.querySelector("#modal").innerHTML = `<div class="modal-backdrop"><form class="drawer compact-drawer" id="procurement-mode-form"><div class="drawer-head"><div><p>Purchase Order master data</p><h2>${existing ? "Edit" : "Add"} Procurement Mode</h2></div><button type="button" id="close">×</button></div><div class="drawer-body"><div class="form-grid single-column-form">
        <label>Mode of Procurement<input name="name" value="${escapeInline(existing?.[0] || "")}" placeholder="e.g. Agency-To-Agency" required></label>
        <label>Status<select name="status"><option ${existing?.[1] !== "Inactive" ? "selected" : ""}>Active</option><option ${existing?.[1] === "Inactive" ? "selected" : ""}>Inactive</option></select></label>
      </div><p class="field-error" id="procurement-mode-error"></p></div><div class="drawer-foot"><button type="button" class="secondary-button" id="cancel">Cancel</button><button class="primary-button">Save procurement mode</button></div></form></div>`;
      const close = () => { document.querySelector("#modal").innerHTML = ""; };
      document.querySelector("#close").onclick = close;
      document.querySelector("#cancel").onclick = close;
      document.querySelector("#procurement-mode-form").onsubmit = async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const name = String(data.get("name") || "").trim();
        const error = document.querySelector("#procurement-mode-error");
        const duplicate = [...refs.procurementModes.keys()].some((value) => value.toLowerCase() === name.toLowerCase() && value !== existing?.[0]);
        if (!name) { error.textContent = "Mode of Procurement is required."; return; }
        if (duplicate) { error.textContent = "This Mode of Procurement already exists."; return; }
        const value = {
          text_value: name,
          json_value: { active: data.get("status") === "Active" },
          description: "Purchase Order mode of procurement",
        };
        try {
          if (stored) await api.update("system_settings", `setting_key=eq.${encodeURIComponent(stored.setting_key)}`, value);
          else await api.insert("system_settings", { setting_key: `procurement_mode:${crypto.randomUUID()}`, ...value });
          close();
          await loadData();
          adminTab = "Procurement Modes";
          render("Admin Options");
          showToast(`Procurement mode ${existing ? "updated" : "saved"} in Supabase.`);
        } catch (reason) {
          error.textContent = reason.message;
        }
      };
      return;
    }

    if (tab === "Items") {
      const existing = index === null ? null : masters.Items[index];
      const stored = existing ? refs.items.get(existing[1]) : null;
      const selectedCode = existing?.[4] || "";
      const selectedClassification = existing?.[6] || "";
      const usedItemCodes = new Set([...refs.items.values()].filter((row) => row.id !== stored?.id).map((row) => String(row.item_code)));
      const nextExpendableStockNumber = () => {
        let candidate = Math.floor(Date.now() / 1000);
        while (usedItemCodes.has(String(candidate))) candidate += 1;
        return String(candidate);
      };
      const existingStockNumber = /^\d{10}$/.test(String(stored?.item_code || "")) ? String(stored.item_code) : "";
      const escape = (value) => String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
      const uacsOptions = classificationSequence.map((classification) => {
        const options = [...refs.uacs.values()]
          .filter((row) => row.active && row.account_category === classification)
          .sort((a, b) => a.account_title.localeCompare(b.account_title))
          .map((row) => `<option value="${escape(row.uacs_code)}" data-classification="${escape(row.account_category)}" ${row.uacs_code === selectedCode ? "selected" : ""}>${escape(row.account_title)} — ${escape(row.uacs_code)}</option>`)
          .join("");
        return options ? `<optgroup label="${classification}">${options}</optgroup>` : "";
      }).join("");

      document.querySelector("#modal").innerHTML = `<div class="modal-backdrop"><form class="drawer compact-drawer" id="item-form"><div class="drawer-head"><div><p>Item master data</p><h2>${existing ? "Edit" : "Add"} Item</h2></div><button type="button" id="close">×</button></div><div class="drawer-body"><div class="form-grid item-master-form">
        <label class="wide">UACS Codes<select name="uacs" id="item-uacs" required><option value="">Select a UACS account</option>${uacsOptions}</select></label>
        <label class="wide">General Name<input name="generalName" value="${escape(stored?.item_name || existing?.[1] || "")}" placeholder="e.g. Bond Paper" required></label>
        <label class="wide">Description<textarea name="description" rows="3" placeholder="e.g. 80 gsm, A4" required>${escape(stored?.description || "")}</textarea></label>
        <label>UOM<select name="uom" required><option value="">Select UOM</option>${masters.UOM.map((row) => `<option value="${escape(row[1])}" ${row[1] === existing?.[3] ? "selected" : ""}>${escape(row[0])} (${escape(row[1])})</option>`).join("")}</select></label>
        <label>Re-Order Point<input name="reorderPoint" type="number" min="0" step="0.001" value="${escape(existing?.[5] || "0")}" required></label>
        <label class="wide">Item Classification<select id="item-classification" disabled aria-describedby="classification-hint"><option value="">Select a UACS account first</option>${["Expendable", "Semi-Expendable", "Capital Outlay"].map((value) => `<option value="${value}" ${value === selectedClassification ? "selected" : ""}>${value}</option>`).join("")}</select><small class="field-hint" id="classification-hint">Automatically determined by the selected UACS account.</small></label>
        <label class="wide" id="stock-number-field" hidden>Stock Number<input name="stockNumber" id="item-stock-number" value="${escape(existingStockNumber)}" readonly><small class="field-hint">Automatically generated from the Unix timestamp in seconds. This applies only to expendable items.</small></label>
      </div><p class="field-error" id="item-error"></p></div><div class="drawer-foot"><button type="button" class="secondary-button" id="cancel">Cancel</button><button class="primary-button">Save item</button></div></form></div>`;

      const close = () => { document.querySelector("#modal").innerHTML = ""; };
      const uacsSelect = document.querySelector("#item-uacs");
      const classificationSelect = document.querySelector("#item-classification");
      const stockNumberField = document.querySelector("#stock-number-field");
      const stockNumberInput = document.querySelector("#item-stock-number");
      const syncClassification = () => {
        const classification = uacsSelect.selectedOptions[0]?.dataset.classification || "";
        classificationSelect.value = classification;
        stockNumberField.hidden = classification !== "Expendable";
        if (classification === "Expendable" && !stockNumberInput.value) {
          stockNumberInput.value = nextExpendableStockNumber();
        }
      };
      document.querySelector("#close").onclick = close;
      document.querySelector("#cancel").onclick = close;
      uacsSelect.onchange = syncClassification;
      syncClassification();

      document.querySelector("#item-form").onsubmit = async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const uacs = refs.uacs.get(String(data.get("uacs") || ""));
        const generalName = String(data.get("generalName") || "").trim();
        const description = String(data.get("description") || "").trim();
        const classification = uacs?.account_category || "";
        const error = document.querySelector("#item-error");
        if (!uacs || !["Expendable", "Semi-Expendable", "Capital Outlay"].includes(classification)) {
          error.textContent = "Select an active UACS account with a valid item classification.";
          return;
        }
        if (!generalName || !description) {
          error.textContent = "General Name and Description are required.";
          return;
        }

        try {
          let category = refs.categories.get(classification);
          if (!category) {
            [category] = await api.insert("item_categories", {
              category_name: classification,
              description: `System classification for ${classification} items.`,
              classification_rule: `Always ${classification}`,
              default_classification: classification,
              threshold_based_classification_enabled: false,
              qualifies_as_ppe: classification !== "Expendable",
              active: true,
            });
          }

          const stockNumber = classification === "Expendable"
            ? String(data.get("stockNumber") || nextExpendableStockNumber())
            : "";
          const value = {
            item_code: classification === "Expendable"
              ? stockNumber
              : stored?.item_code || `ITM-${uacs.uacs_code}-${Date.now().toString(36).toUpperCase()}`,
            item_name: generalName,
            description,
            category_id: category.id,
            unit_of_measure: String(data.get("uom") || "").trim(),
            default_uacs_account_id: uacs.id,
            reorder_level: Number(data.get("reorderPoint") || 0),
            default_classification: classification,
            active: true,
          };
          if (stored) await api.update("items", `id=eq.${stored.id}`, value);
          else await api.insert("items", value);
          close();
          await loadData();
          adminTab = "Items";
          render("Admin Options");
          showToast(`Item ${existing ? "updated" : "saved"} in Supabase.`);
        } catch (reason) {
          error.textContent = reason.message;
        }
      };
      return;
    }
    if (tab !== "UACS") return originalOpenMaster(tab, index);
    const existing = index === null ? null : masters.UACS[index];
    document.querySelector("#modal").innerHTML = `<div class="modal-backdrop"><form class="drawer compact-drawer" id="uacs-form"><div class="drawer-head"><div><p>UACS master data</p><h2>${existing ? "Edit" : "Add"} UACS Account</h2></div><button type="button" id="close">×</button></div><div class="drawer-body"><div class="form-grid"><label>UACS Object Code<input name="code" value="${existing?.[0] || ""}" required></label><label>Account title<input name="title" value="${existing?.[1] || ""}" required></label><label>Classification<select name="classification"><option ${existing?.[2] === "Expendable" ? "selected" : ""}>Expendable</option><option ${existing?.[2] === "Semi-Expendable" ? "selected" : ""}>Semi-Expendable</option><option ${existing?.[2] === "Capital Outlay" ? "selected" : ""}>Capital Outlay</option></select></label><label>PPE Sub-Major<input name="subMajor" value="${existing?.[3] || ""}" maxlength="2" placeholder="Optional"></label><label>GL Account<input name="glAccount" value="${existing?.[4] || ""}" maxlength="2" placeholder="Optional"></label><label>Status<select name="status"><option ${existing?.[5] !== "Inactive" ? "selected" : ""}>Active</option><option ${existing?.[5] === "Inactive" ? "selected" : ""}>Inactive</option></select></label></div></div><div class="drawer-foot"><button type="button" class="secondary-button" id="cancel">Cancel</button><button class="primary-button">Save UACS account</button></div></form></div>`;
    const close = () => { document.querySelector("#modal").innerHTML = ""; };
    document.querySelector("#close").onclick = close;
    document.querySelector("#cancel").onclick = close;
    document.querySelector("#uacs-form").onsubmit = async (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const value = {
        uacs_code: String(data.get("code")).trim(),
        account_title: String(data.get("title")).trim(),
        account_category: String(data.get("classification")),
        ppe_sub_major: String(data.get("subMajor") || "").trim() || null,
        gl_account: String(data.get("glAccount") || "").trim() || null,
        active: data.get("status") === "Active",
      };
      try {
        const stored = existing ? refs.uacs.get(existing[0]) : null;
        if (stored) await api.update("uacs_accounts", `id=eq.${stored.id}`, value);
        else await api.insert("uacs_accounts", value);
        close();
        await loadData();
        adminTab = "UACS";
        render("Admin Options");
        showToast(`UACS account ${existing ? "updated" : "saved"} in Supabase.`);
      } catch (error) { showToast(error.message, "error"); }
    };
  };

  async function loadUserProfiles() {
    if (!access?.isSuperAdmin) {
      window.inventoryUserProfiles = [];
      window.inventoryAuditLogs = [];
      return;
    }
    window.inventoryUserProfiles = await api.select("profiles", "select=*&order=role,email");
    try {
      window.inventoryAuditLogs = await api.select("audit_logs", "select=*&order=action_at.desc&limit=1000");
    } catch (error) {
      window.inventoryAuditLogs = [];
      console.warn("Activity Log is waiting for its Supabase migration.", error);
    }
  }

  window.reloadInventoryAuditLogs = async () => {
    if (!access?.isSuperAdmin) return [];
    try {
      window.inventoryAuditLogs = await api.select("audit_logs", "select=*&order=action_at.desc&limit=1000");
    } catch (error) {
      window.inventoryAuditLogs = [];
      showToast(`Could not refresh Activity Log: ${error.message}`, "error");
    }
    return window.inventoryAuditLogs;
  };

  function renderViewerPortal() {
    document.body.classList.remove("auth-mode", "loading-mode", "profile-setup-mode");
    document.body.classList.add("viewer-portal-mode");
    document.body.classList.remove("dashboard-watermark");
    const employees = [...refs.employees.values()]
      .filter((employee) => employee.active !== false)
      .sort((a, b) => String(a.full_name || "").localeCompare(String(b.full_name || "")));
    const headers = `<thead><tr><th>ITEM NO.</th><th>ITEM DESCRIPTION</th><th>BRAND</th><th>MODEL</th><th>SERIAL NO.</th><th>PPE NO.</th><th>INVENTORY NO.</th><th>AMOUNT</th><th>DATE ACQUIRED</th><th>SUPPLIER</th></tr></thead>`;
    const rowsFor = (classification, employeeId) => {
      const rows = propertyUnits
        .filter((unit) => unit.classification === classification && unit.employeeId === employeeId)
        .sort((a, b) => String(a.item || "").localeCompare(String(b.item || "")) || String(a.number || a.inventoryNumber || "").localeCompare(String(b.number || b.inventoryNumber || "")));
      if (!rows.length) return "";
      return rows.map((unit, index) => `<tr><td>${index + 1}</td><td>${escapeProfile(unit.description || unit.item || "")}</td><td>${escapeProfile(unit.brand || "")}</td><td>${escapeProfile(unit.model || "")}</td><td>${escapeProfile(unit.serial || "")}</td><td>${escapeProfile(unit.number || "")}</td><td>${escapeProfile(unit.inventoryNumber || "")}</td><td>${escapeProfile(Number(unit.cost || 0).toLocaleString("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 }))}</td><td>${escapeProfile(unit.date || "")}</td><td>${escapeProfile(unit.supplier || "")}</td></tr>`).join("");
    };
    document.querySelector("#main").innerHTML = `<main class="viewer-issued-page"><div class="viewer-agency-mark" aria-hidden="true">AI</div><h1 class="viewer-agency-name" data-agency-name>${escapeProfile(agencyBranding.agencyName)}</h1><div class="viewer-controls"><label class="viewer-employee-field">Employee<select id="viewer-employee-select"><option value="">Select employee</option>${employees.map((employee) => `<option value="${escapeProfile(employee.id)}">${escapeProfile(employee.full_name)}</option>`).join("")}</select></label><button class="primary-button viewer-print-button" id="viewer-print" type="button" disabled>Print</button></div><p class="viewer-print-employee">Employee: <strong id="viewer-print-employee-name"></strong></p><section class="viewer-issued-section"><h2>Semi-Expendable</h2><div class="viewer-table-wrap"><table>${headers}<tbody id="viewer-semi-body"></tbody></table></div></section><section class="viewer-issued-section"><h2>Capital Outlay</h2><div class="viewer-table-wrap"><table>${headers}<tbody id="viewer-capital-body"></tbody></table></div></section></main>`;
    applyAgencyBranding(document.querySelector("#main"));
    document.querySelector("#viewer-employee-select").onchange = (event) => {
      const employeeId = event.currentTarget.value;
      document.querySelector("#viewer-semi-body").innerHTML = rowsFor("Semi-Expendable", employeeId);
      document.querySelector("#viewer-capital-body").innerHTML = rowsFor("Capital Outlay", employeeId);
      document.querySelector("#viewer-print-employee-name").textContent = event.currentTarget.selectedOptions[0]?.textContent || "";
      document.querySelector("#viewer-print").disabled = !employeeId;
    };
    document.querySelector("#viewer-print").onclick = () => window.print();
    syncHistory("viewer");
  }

  async function openPublicViewMode() {
    connectionScreen("Loading View Mode", "Preparing the read-only issued property list…");
    try {
      const [employees, units] = await Promise.all([
        api.publicRpc("public_viewer_employees"),
        api.publicRpc("public_viewer_property"),
      ]);
      refs.employees = new Map((employees || []).map((employee) => [employee.full_name, { ...employee, active: true }]));
      propertyUnits = (units || []).map((unit) => ({
        dbId: unit.id,
        classification: unit.classification,
        item: unit.item_description || "",
        description: unit.item_description || "",
        brand: unit.brand || "",
        model: unit.model || "",
        serial: unit.serial_number || "",
        number: unit.ppe_number || "",
        inventoryNumber: unit.inventory_number || "",
        cost: Number(unit.amount || 0),
        date: dateLabel(unit.date_acquired),
        isoDate: unit.date_acquired || "",
        supplier: unit.supplier_name || "",
        employeeId: unit.employee_id || "",
      }));
      access = { profile: { role: "viewer", full_name: "View Mode" }, isSuperAdmin: false, isStaff: false, isViewer: true, isPublicViewer: true };
      window.inventoryAccess = access;
      renderViewerPortal();
    } catch (error) {
      entrySelected = false;
      window.inventoryAuthNotice = "View Mode could not load. Please review the message below or sign in normally.";
      await start();
      const message = document.querySelector("#login-error");
      if (message) message.textContent = `View Mode error: ${error.message}`;
    }
  }

  function applyRoleUi() {
    if (!access) return;
    updateSignedInProfile();
    if (access.isViewer) {
      document.querySelector('[data-view="Admin Options"]')?.remove();
      const viewerSelectors = [
        "#new-po", "#new-ris", "#add-master", "#save-setting", "#generate-rsmi",
        "[data-edit-po]", "[data-iar]", "[data-edit-ris]", "[data-edit-property]", "[data-edit-master]",
        "[data-transfer-property]", "[data-unserviceable-property]", "[data-complete]", "[data-process]",
        "[data-complete-ris]", "[data-delete-po]", "[data-delete-iar]", "[data-delete-ris]",
        "[data-unpost-po]", "[data-unpost-iar]", "[data-unpost-ris]", "[data-go='Admin Options']",
        "button[name='intent'][value='approve']", "#approve-ris"
      ];
      document.querySelectorAll(viewerSelectors.join(",")).forEach((element) => element.remove());
    }
    if (access.isStaff) {
      const staffRestrictedSelectors = [
        "[data-delete-po]", "[data-delete-iar]", "[data-delete-ris]",
        "[data-unpost-po]", "[data-unpost-iar]", "[data-unpost-ris]"
      ];
      document.querySelectorAll(staffRestrictedSelectors.join(",")).forEach((element) => element.remove());
    }

    document.querySelectorAll("[data-save-profile]").forEach((button) => {
      if (button.dataset.profileBound) return;
      button.dataset.profileBound = "true";
      button.addEventListener("click", async () => {
        const row = button.closest("[data-profile-row]");
        const role = row.querySelector("[data-profile-role]").value;
        const active = row.querySelector("[data-profile-active]").checked;
        button.disabled = true;
        button.textContent = "Saving…";
        try {
          await api.rpc("admin_update_profile", { p_user_id: button.dataset.saveProfile, p_role: role, p_employee_id: null, p_active: active });
          await loadUserProfiles();
          adminTab = "Users";
          render("Admin Options");
          showToast("User access updated.");
        } catch (error) {
          button.disabled = false;
          button.textContent = "Save";
          showToast(error.message, "error");
        }
      });
    });
  }

  const applicationRender = window.render;
  window.render = function roleAwareRender(view) {
    if (access?.isViewer) {
      renderViewerPortal();
      return;
    }
    document.body.classList.remove("viewer-portal-mode");
    document.body.classList.toggle("dashboard-watermark", view === "Dashboard");
    applicationRender(view);
    syncHistory("module", view);
    queueMicrotask(applyRoleUi);
  };

  const roleObserver = new MutationObserver(() => applyRoleUi());
  const brandingObserver = new MutationObserver(() => applyAgencyBranding());
  roleObserver.observe(document.body, { childList: true, subtree: true });
  brandingObserver.observe(document.body, { childList: true, subtree: true });

  async function finishStartup() {
    await Promise.all([loadData(), loadUserProfiles()]);
    installAccountControls();
    updateSignedInProfile();
    applyAgencyBranding();
    render("Dashboard");
  }

  async function start() {
    if (new URLSearchParams(location.search).get("loading-demo") === "1") {
      connectionScreen("Loading your workspace", "Preparing secure inventory and property records…");
      return;
    }
    if (!api?.configured) return connectionScreen("Connection details missing", "Add the Supabase URL and publishable key to .env.local, then rebuild the app.");
    await api.ensureSession();
    if (!entrySelected && api.session) await api.signOut();
    if (!api.session) {
      syncHistory("login", "", "replace");
      const accessMessage = window.inventoryAuthNotice || "Use your approved account or submit a new registration.";
      window.inventoryAuthNotice = "";
      connectionScreen("Sign in to inventory", accessMessage, true);
      const loginForm = document.querySelector("#backend-login");
      const registerForm = document.querySelector("#backend-register");
      const loginTab = document.querySelector("#show-login");
      const registerTab = document.querySelector("#show-register");
      const showAuthForm = (registering) => {
        loginForm.hidden = registering;
        registerForm.hidden = !registering;
        loginTab.classList.toggle("active", !registering);
        registerTab.classList.toggle("active", registering);
      };
      loginTab.onclick = () => showAuthForm(false);
      registerTab.onclick = () => showAuthForm(true);
      document.querySelector("#enter-view-mode").onclick = async () => {
        entrySelected = true;
        await openPublicViewMode();
      };
      document.querySelector("#backend-login").onsubmit = async (event) => {
        event.preventDefault();
        const error = document.querySelector("#login-error");
        error.textContent = "";
        try {
          const data = new FormData(event.currentTarget);
          await api.signIn(String(data.get("email")), String(data.get("password")));
          entrySelected = true;
          await start();
        } catch (reason) { error.textContent = reason.message; }
      };
      registerForm.onsubmit = async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const message = document.querySelector("#register-message");
        const data = new FormData(form);
        const password = String(data.get("password") || "");
        if (password !== String(data.get("confirmPassword") || "")) {
          message.textContent = "Passwords do not match.";
          return;
        }
        message.textContent = "Submitting…";
        try {
          await api.signUp(String(data.get("email") || "").trim(), password);
          form.reset();
          message.classList.add("success-message");
          message.textContent = "Registration successful. Your account is now pending Super Admin approval.";
        } catch (reason) {
          message.classList.remove("success-message");
          message.textContent = reason.message;
        }
      };
      return;
    }
    connectionScreen("Loading your workspace", "Checking your account role and permitted records…");
    try {
      const ensured = await api.rpc("ensure_my_profile", {});
      const profile = Array.isArray(ensured) ? ensured[0] : ensured;
      if (!profile?.active || profile.role === "pending") {
        await api.signOut();
        window.inventoryAuthNotice = "Your registration is pending Super Admin approval.";
        return start();
      }
      access = {
        profile,
        isSuperAdmin: profile.role === "super_admin",
        isStaff: profile.role === "staff",
        isViewer: profile.role === "viewer",
      };
      loadAgencyBranding();
      applyAgencyBranding();
      window.inventoryAccess = access;
      if (Object.prototype.hasOwnProperty.call(profile, "profile_completed") && profile.profile_completed !== true) {
        openProfileEditor(true);
        return;
      }
      await finishStartup();
    } catch (error) {
      connectionScreen("Account access needs attention", error.message);
    }
  }

  window.addEventListener("popstate", async (event) => {
    const route = event.state?.inventoryRoute || "login";
    historyNavigation = true;
    try {
      if (route === "module" && access && !access.isViewer) {
        window.render(event.state?.view || "Dashboard");
        return;
      }
      if (route === "viewer") {
        if (access?.isViewer) {
          renderViewerPortal();
        } else {
          entrySelected = true;
          await openPublicViewMode();
        }
        return;
      }

      if (api.session) await api.signOut();
      access = null;
      window.inventoryAccess = null;
      entrySelected = false;
      await start();
    } finally {
      historyNavigation = false;
    }
  });

  start();
})();
