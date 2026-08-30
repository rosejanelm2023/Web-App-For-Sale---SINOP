const peso = new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP",maximumFractionDigits:0});
const localISODate=(value=new Date())=>{
  const date=value instanceof Date?value:new Date(value);
  if(Number.isNaN(date.getTime()))return "";
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
};
const normalizeDatePickerValue=value=>{
  const raw=String(value||"").trim();
  if(!raw)return "";
  const iso=raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(iso)return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const parsed=new Date(raw);
  return Number.isNaN(parsed.getTime())?"":localISODate(parsed);
};
function prepareDatePickers(root=document){
  root.querySelectorAll('input[type="date"]').forEach(input=>{
    const normalized=normalizeDatePickerValue(input.getAttribute("value")||input.value);
    if(normalized&&input.value!==normalized)input.value=normalized;
    input.autocomplete="off";
    input.classList.add("date-picker");
  });
}
let pos = [];
let iars = [];
let risRecords = [];
let propertyUnits = [];
let rsmiRecords = [];
const masters = {
  Suppliers:[],
  Items:[],
  ItemDetails:[],
  Categories:[],
  Employees:[],
  Plantilla:[],
  Departments:[],
  UOM:[],
  ProcurementModes:[],
  UACS:[]
};
let adminTab="Suppliers";
let reportTab="Overview";
let formTab="Appendix 57 (SLC)";
let stockCardItemKey="";
let suppliesLedgerItemKey="";
let propertyCardKey="";
let ppeLedgerKey="";
let icsPropertyKey="";
let parPropertyKey="";
let ptrSelectedKeys=[];
let ptrState={number:"",date:localISODate(),from:"",to:"",type:"Reassignment",otherType:"",reason:"",approved:"",released:"",received:""};
const disposalFormStates={
  wmr:{place:"",date:"",certified:"",approved:"",inspection:"",witness:"",disposalMethod:"Destroyed",transferAgency:""},
  iirup:{asOf:"",accountable:"",station:"",approved:"",inspection:"",witness:""},
  rlsddp:{propertyKey:"",number:"",date:"",policeNotified:"No",policeStation:"",policeDate:"",status:"Damaged",circumstances:"",supervisor:"",accountableDate:"",supervisorDate:"",governmentId:"",idNumber:"",idDate:"",swornDay:"",swornMonth:"",swornYear:"",docNumber:"",pageNumber:"",bookNumber:"",series:""}
};
let propertyActionMenuIndex=null;
let propertyRecordsMode="";
const reportDateFilters={};
const physicalReportStates={
  rcpi:{category:"",asOf:"",certified:"",approved:"",verified:""},
  rpcppe:{category:"",asOf:"",certified:"",approved:"",verified:""},
  semiRegistry:{category:"",asOf:"",certified:"",approved:"",verified:""}
};
const badge = value => `<span class="badge badge-${value==="Completed"||value==="Active"?"green":value==="Draft"?"gray":value.includes("Partial")?"amber":value==="Cancelled"?"red":"blue"}"><i></i>${value}</span>`;
const metric = (label,value,sub,tone) => `<article class="metric-card"><span class="metric-icon ${tone}">${label.split(" ").map(x=>x[0]).slice(0,2).join("")}</span><div><p>${label}</p><strong>${value}</strong><small>${sub}</small></div></article>`;
const panelTable = rows => `<div class="table-wrap"><table><thead><tr><th>PO number</th><th>Supplier</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>${rows.map(r=>`<tr><td><strong class="linkish">${r[0]}</strong></td><td>${r[2]}</td><td>${r[1]}</td><td>${peso.format(r[5])}</td><td>${badge(r[6])}</td></tr>`).join("")}</tbody></table></div>`;
const itemClassificationFromName = name => masters.Items.find(record=>record[1]===name)?.[6]||"";
const unitProcessingText = item => {
  const classification=item.classification||itemClassificationFromName(item.description);
  const quantity=Number(item.qty??item.orderedQty??0);
  return classification==="Semi-Expendable"||classification==="Capital Outlay"
    ? `${quantity} individual property unit${quantity===1?"":"s"}`
    : `${quantity} unit${quantity===1?"":"s"} in one inventory batch`;
};

function dashboard(){
  const theme=readTenantSettings();
  const currentUser=window.inventoryAccess?.profile;
  const users=(window.inventoryPresenceUsers?.length?window.inventoryPresenceUsers:currentUser?[currentUser]:[]).filter(user=>user.active!==false);
  if(currentUser&&!users.some(user=>user.id===currentUser.id))users.unshift({...currentUser,active:true});
  const balanceRows=buildInventoryBalanceRows();
  const totalIn=balanceRows.reduce((sum,row)=>sum+row.inQty,0);
  const totalOut=balanceRows.reduce((sum,row)=>sum+row.outQty,0);
  const totalBalance=balanceRows.reduce((sum,row)=>sum+row.balance,0);
  const lowStock=balanceRows.filter(row=>row.balance<=row.reorderPoint);
  const userCards=users.map(user=>{const name=user.full_name||user.name||user.email||"Unnamed user";const initials=name.split(/\s+/).filter(Boolean).map(part=>part[0]).slice(0,2).join("").toUpperCase();return `<li><span>${escapeFormValue(initials||"U")}</span><p><strong>${escapeFormValue(name)}</strong><small>${escapeFormValue(user.role||"User")}</small></p><i>Connected</i></li>`}).join("");
  const rows=balanceRows.map(row=>`<tr data-dashboard-stock-row data-search="${escapeFormValue(`${row.item} ${row.description} ${row.stockNumber}`.toLowerCase())}"><td><strong>${escapeFormValue(row.item)}</strong><small>${escapeFormValue(row.description)}</small></td><td>${escapeFormValue(row.stockNumber||"—")}</td><td>${escapeFormValue(row.uom||"—")}</td><td><strong class="movement-in">${row.inQty}</strong></td><td><strong class="movement-out">${row.outQty}</strong></td><td><strong>${row.balance}</strong></td><td>${row.balance<=row.reorderPoint?badge("Low stock"):badge("Active")}</td></tr>`).join("");
  return `<section class="dashboard-hero"><div class="dashboard-agency-identity"><span class="dashboard-agency-logo">${theme.logoPreview?`<img src="${escapeFormValue(theme.logoPreview)}" alt="${escapeFormValue(theme.agencyName)} logo">`:`<b>${escapeFormValue((theme.agencyName||"S").slice(0,1).toUpperCase())}</b>`}</span><div><p>INVENTORY AND PROPERTY MANAGEMENT</p><h2>${escapeFormValue(theme.agencyName||"Your Agency")}</h2><small>${escapeFormValue(theme.agencyAddress||"Agency address can be added in System Settings")}</small></div></div><div class="ph-clock-card"><span>PHILIPPINE STANDARD TIME</span><strong id="ph-live-time">--:--:--</strong><p id="ph-live-date">Asia/Manila · UTC+8</p></div></section>
  <section class="dashboard-live-summary"><article class="connected-users-card panel"><div class="panel-heading"><div><h3>Connected users now</h3><p>Names currently active in this workspace.</p></div><span class="connected-count">${users.length}</span></div>${users.length?`<ul>${userCards}</ul>`:`<div class="empty-state compact"><h3>No connected users</h3><p>Active sessions will appear here.</p></div>`}</article><article class="balance-summary-card panel"><div class="panel-heading"><div><h3>Inventory balance</h3><p>Expendable stock from completed IAR and RIS transactions.</p></div></div><div><span><small>Stock In</small><strong>${totalIn}</strong></span><span><small>Stock Out</small><strong>${totalOut}</strong></span><span><small>Balance</small><strong>${totalBalance}</strong></span><span><small>Low Stock</small><strong>${lowStock.length}</strong></span></div></article></section>
  <section class="panel dashboard-inventory-balance"><div class="panel-heading"><div><h3>Inventory Balance</h3><p>Expendable items only, sorted A–Z.</p></div><button class="text-button" data-open-report="Inventory Balance">Open full report →</button></div><div class="dashboard-stock-search"><label class="search">⌕<input id="dashboard-stock-search" placeholder="Search item name or stock number…"></label><span id="dashboard-stock-count">${balanceRows.length} items</span></div>${balanceRows.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Item</th><th>Stock Number</th><th>UOM</th><th>In</th><th>Out</th><th>Balance</th><th>Status</th></tr></thead><tbody>${rows}<tr id="dashboard-stock-empty" hidden><td colspan="7"><div class="empty-state compact"><h3>No matching item</h3><p>Try another item name or stock number.</p></div></td></tr></tbody></table></div>`:`<div class="empty-state"><span>IB</span><h3>No expendable inventory balance yet</h3><p>Complete an expendable IAR to begin.</p></div>`}</section>`;
}

function buildInventoryBalanceRows(){
  return buildAppendix58Cards().map(card=>{
    const last=card.transactions.at(-1)||{balance:0};
    const master=masters.Items.find(row=>String(row[0])===String(card.stockNumber)||row[1]===card.item||row[1]===card.description);
    return {key:card.key,item:card.item||card.description||"Unnamed item",description:card.description||"",stockNumber:card.stockNumber||master?.[0]||"",uom:card.uom||master?.[3]||"—",inQty:card.transactions.reduce((sum,row)=>sum+Number(row.receipt||0),0),outQty:card.transactions.reduce((sum,row)=>sum+Number(row.issue||0),0),balance:Number(last.balance||0),reorderPoint:Number(card.reorderPoint??master?.[5]??0)};
  }).sort((a,b)=>a.item.localeCompare(b.item,undefined,{sensitivity:"base",numeric:true})||a.description.localeCompare(b.description,undefined,{sensitivity:"base",numeric:true}));
}

function readTenantSettings(){
  try{return {...{agencyName:"Sinop Demo Agency",agencyAddress:"",colors:["#0F2942","#059669"],formula:"FIFO"},...JSON.parse(localStorage.getItem("sinop-tenant-theme")||"{}")}}catch{return {agencyName:"Sinop Demo Agency",agencyAddress:"",colors:["#0F2942","#059669"],formula:"FIFO"}}
}
function readableTextFor(color){const value=String(color||"").replace("#","");if(!/^[0-9a-f]{6}$/i.test(value))return "#ffffff";const channels=[0,2,4].map(offset=>parseInt(value.slice(offset,offset+2),16)/255).map(channel=>channel<=.03928?channel/12.92:((channel+.055)/1.055)**2.4);return .2126*channels[0]+.7152*channels[1]+.0722*channels[2]>.48?"#10232f":"#ffffff"}

function purchaseOrders(){
  return `<section class="page-heading"><div><h2>Purchase Orders</h2><p>Encode, track, and manage all purchase orders.</p></div><button class="primary-button" id="new-po">＋ Create purchase order</button></section><section class="mini-stats"><div><span>All purchase orders</span><strong>${pos.length}</strong></div><div><span>Active</span><strong>${pos.filter(x=>x[6]!=="Cancelled").length}</strong></div><div><span>Completed this month</span><strong>${pos.filter(x=>x[6]==="Completed").length}</strong></div><div><span>Total value</span><strong>${peso.format(pos.reduce((a,x)=>a+x[5],0))}</strong></div></section><section class="panel"><div class="toolbar"><label class="search">⌕<input id="po-search" placeholder="Search PO number or supplier…"></label><div><select><option>All statuses</option></select><button class="secondary-button">⇩ Export</button></div></div><div id="po-table">${poDetailTable(pos)}</div></section>`;
}
function poDetailTable(rows){
  if(!rows.length)return `<div class="empty-state"><span>PO</span><h3>No purchase orders yet</h3><p>Create your first purchase order to begin.</p></div>`;
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>PO number</th><th>Date</th><th>Supplier / PR no.</th><th>Procurement mode</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows.map(r=>{
    const i=pos.indexOf(r);
    const linkedIar=iars.find(iar=>iar[1]===r[0]);
    const iarWasCreated=Boolean(r[7]||linkedIar);
    const actions=iarWasCreated
      ? `<button data-view-po="${i}">View</button><button data-unpost-po="${i}" ${linkedIar?`disabled title="Delete ${linkedIar[0]} before unposting this purchase order"`:""}>Unpost</button>`
      : `<button data-view-po="${i}">View</button><button data-edit-po="${i}">Edit</button><button data-delete-po="${i}">Delete</button>${r[6]==="Completed"?`<button data-unpost-po="${i}">Unpost</button><button data-iar="${i}">Create IAR</button>`:""}`;
    return `<tr><td><strong class="linkish">${r[0]}</strong></td><td>${r[1]}</td><td><strong>${r[2]}</strong><small>${r[3]}</small></td><td>${r[4]}</td><td><strong>${peso.format(r[5])}</strong></td><td>${badge(r[6])}</td><td><div class="row-actions">${actions}</div></td></tr>`;
  }).join("")}</tbody></table></div><div class="pagination"><span>Showing 1–${rows.length} of ${rows.length}</span><div><button disabled>‹</button><button class="active">1</button><button>›</button></div></div>`;
}

function iarView(){
 const records=iars.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>IAR number</th><th>Related PO</th><th>Supplier</th><th>IAR date</th><th>Invoice</th><th>Classification</th><th>Status</th><th>Actions</th></tr></thead><tbody>${iars.map((r,i)=>`<tr><td><strong class="linkish">${r[0]}</strong></td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r.invoiceNo||"—"}<small>${r.invoiceDate||"No invoice date"}</small></td><td><span class="class-tag">${r[5]}</span></td><td>${badge(r[6])}</td><td><div class="row-actions">${r[6]!=="Completed"?`<button data-process="${i}">Complete & process</button>`:`<button data-unpost-iar="${i}">Unpost</button>`}<button data-view-iar="${i}">View</button>${r[6]!=="Completed"?`<button data-delete-iar="${i}">Delete</button>`:""}</div></td></tr>`).join("")}</tbody></table></div>`:`<div class="empty-state"><span>IA</span><h3>No inspection reports yet</h3><p>Complete a purchase order, then create its inspection and acceptance report.</p></div>`;
 return `<section class="page-heading"><div><h2>Inspection and Acceptance Reports</h2><p>Inspect deliveries and process only accepted quantities into inventory.</p></div><button class="primary-button">＋ Create from completed PO</button></section><section class="process-line"><div class="done"><b>1</b><span>Purchase order<small>Completed</small></span></div><i></i><div class="current"><b>2</b><span>Inspection & acceptance<small>Validate delivery</small></span></div><i></i><div><b>3</b><span>Item classification<small>Automatic by category</small></span></div><i></i><div><b>4</b><span>Inventory records<small>Batches or property units</small></span></div></section><section class="panel"><div class="toolbar"><label class="search">⌕<input placeholder="Search IAR or PO number…"></label><select><option>All statuses</option></select></div>${records}</section><section class="info-banner"><span>i</span><div><strong>Classification rule in effect</strong><p>Consumables are expendable. Property below ₱50,000 per item is semi-expendable; qualifying PPE at ₱50,000 or above is capital outlay. Manual corrections require a reason.</p></div><button data-go="Admin Options">Review categories</button></section>`;
}

function risView(){
 return enhancedRIS();
}

function adminView(){
 return enhancedAdmin();
}
function reportsView(){
 return enhancedReports();
}

const formOptions=["RIS","RSMI","Appendix 57 (SLC)","Appendix 58 (SC)","Appendix 59 (ICS)","Appendix 65 (WMR)","Appendix 69 (PC)","Appendix 70 (PPELC)","Appendix 71 (PAR)","Appendix 74 (IIRUP)","Appendix 75 (RLSDDP)","Appendix 76 (PTR)","Semi-Expendable","Capital Outlay","Inventory Balance"];
const physicalReportOptions=["Appendix 66 (RCPI)","Appendix 73 (RPCPPE)","Annex A.4"];
function openReportDestination(key){
  if(physicalReportOptions.includes(key)){
    reportTab=key;
    render("Reports");
    return;
  }
  formTab=formOptions.includes(key)?key:formOptions[0];
  render("Forms");
}
function rerenderReportSurface(){render(current==="Forms"?"Forms":"Reports")}
function formsView(){
  if(!formOptions.includes(formTab))formTab=formOptions[0];
  return `<section class="page-heading forms-heading"><div><h2>Forms</h2><p>Select the form or operational report you want to prepare using saved records.</p></div><label class="forms-report-picker">Form or report<select id="forms-report-select">${formOptions.map(option=>`<option ${option===formTab?"selected":""}>${option}</option>`).join("")}</select></label></section>${reportContent(formTab)}`;
}

const views={"Dashboard":dashboard,"Purchase Orders":purchaseOrders,"Inspection & Acceptance":iarView,"Requisition & Issue Slips":enhancedRIS,"Property Records":propertyRecordsView,"Admin Options":enhancedAdmin,"Forms":formsView,"Reports":enhancedReports,"RSMI Generation":rsmiGenerationView};
let current="Dashboard";
function render(view){
 current=view; document.querySelector("#page-title").textContent=view; document.querySelector("#main").innerHTML=views[view]();
 document.querySelectorAll(".sidebar nav button").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
 document.querySelector("#sidebar").classList.remove("open"); prepareDatePickers(document.querySelector("#main")); bindEnhanced();
}
function bind(){
 document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>render(b.dataset.go));
 document.querySelector("#new-po")?.addEventListener("click",openPO);
 document.querySelector("#po-search")?.addEventListener("input",e=>{const q=e.target.value.toLowerCase();document.querySelector("#po-table").innerHTML=poDetailTable(pos.filter(r=>(r[0]+" "+r[2]).toLowerCase().includes(q)));bind()});
 document.querySelectorAll("[data-complete]").forEach(b=>b.onclick=()=>{pos[+b.dataset.complete][6]="Completed";render(current)});
 document.querySelectorAll("[data-iar]").forEach(b=>b.onclick=()=>openIARForm(+b.dataset.iar));
 document.querySelectorAll("[data-process]").forEach(b=>b.onclick=()=>render(current));
 document.querySelector("#new-ris")?.addEventListener("click",openRISForm);
 document.querySelector("#save-setting")?.addEventListener("click",e=>{e.target.textContent="✓ Setting saved";setTimeout(()=>e.target.textContent="Save setting",1800)});
 document.querySelectorAll(".generate").forEach(b=>b.onclick=()=>{b.textContent="✓ Prepared";b.style.color="var(--tenant-accent)"});
}
function openPO(){
  const uomOptions=(selected="")=>`<option value="">Select UOM</option>${masters.UOM.map(row=>`<option value="${row[1]}" ${row[1]===selected?"selected":""}>${row[0]} (${row[1]})</option>`).join("")}`;
  const procurementModeOptions=()=>masters.ProcurementModes.filter(row=>row[1]==="Active").map(row=>`<option value="${escapeFormValue(row[0])}">${escapeFormValue(row[0])}</option>`).join("");
  document.querySelector("#modal").innerHTML=`
    <div class="modal-backdrop">
      <form class="drawer po-drawer" id="po-form">
        <div class="drawer-head">
          <div><p>New transaction</p><h2>Create purchase order</h2></div>
          <button type="button" id="close">×</button>
        </div>
        <div class="drawer-body">
          <h3>PO header information</h3>
          <div class="form-grid">
            <label>PO number <span class="required-mark">*</span><input name="number" placeholder="Enter PO number" required><small class="field-hint">Required. Enter the official PO number manually.</small></label>
            <label>PO date <span class="required-mark">*</span><input name="date" type="date" required><small class="field-hint">Required before saving or approval.</small></label>
            <label class="wide">Supplier <span class="required-mark">*</span><select id="po-supplier" name="supplier" required><option value="">Select supplier from master data</option>${masters.Suppliers.filter(s=>s[5]==="Active").map(s=>`<option value="${s[0]}">${s[0]}</option>`).join("")}</select></label>
            <label class="wide">Supplier address<textarea id="po-supplier-address" name="supplierAddress" placeholder="Select a supplier to load its address" readonly></textarea><small class="field-hint">Linked to the supplier master record. Edit this address under Admin Options → Suppliers.</small></label>
            <label>Purchase Request no. <span class="optional-mark">Optional</span><input name="pr" placeholder="May be left blank"></label>
            <label>Mode of procurement <span class="required-mark">*</span><select name="mode" required><option value="">Select mode of procurement</option>${procurementModeOptions()}</select></label>
            <label class="wide">Purpose <span class="optional-mark">Optional</span><textarea name="purpose" placeholder="Enter the purpose of this purchase order"></textarea></label>
            <label class="wide">Delivery location<input value="3rd Floor Esquina Dos Bldg, J.C. Aquino Ave, Butuan City" readonly><small class="field-hint">Permanent delivery location</small></label>
            <label>Delivery period<input name="deliveryPeriod" placeholder="15 calendar days"></label>
            <label>Fund source<select name="fund"><option>Regular Fund 01</option></select></label>
          </div>
          <div class="po-items-heading">
            <div><h3>Purchase order items</h3><p>Enter one consolidated line per item. Accepted property quantities are split into individual units after IAR approval.</p></div>
            <div class="po-items-heading-actions"><button type="button" id="add-po-master-item">＋ New master item</button><button type="button" id="add-po-item">＋ Add line</button></div>
          </div>
          <div class="po-item-table-wrap">
            <table class="po-item-editor">
              <thead><tr><th>Item No.</th><th>UOM</th><th>Item Description</th><th>QTY</th><th>Unit Cost</th><th>Total Cost</th><th class="po-line-action-heading"><span class="sr-only">Actions</span></th></tr></thead>
              <tbody id="po-item-rows">
                <tr>
                  <td><input aria-label="Item number" value="1" readonly></td>
                  <td><select aria-label="Unit of measure" name="unit" required>${uomOptions()}</select></td>
                  <td><select aria-label="Item description" name="item" required><option value="">Select item from master data</option></select></td>
                  <td><input aria-label="Quantity" class="po-qty" name="qty" type="number" value="1" min="1" step="1" required></td>
                  <td><input aria-label="Unit cost" class="po-cost" name="cost" type="number" value="0" min="0" step="0.01" required></td>
                  <td><output class="po-row-total">₱0.00</output></td>
                  <td class="po-line-action"><button type="button" class="remove-po-item" aria-label="Delete line item 1" title="Delete line item"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/></svg></button></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="notice-note"><strong>Consolidated-to-unit rule:</strong> A quantity of 20 laptops remains one PO and IAR line, but approval creates 20 separate Semi-Expendable or Capital Outlay property records for 1:1 issuance and accountability.</div>
          <div class="po-grand-total"><span>Total Purchase Order Amount</span><strong id="po-grand-total">₱0.00</strong></div>
        </div>
        <div class="drawer-foot po-actions">
          <button class="secondary-button" name="intent" value="draft">Save as Draft</button>
          <button class="primary-button" name="intent" value="approve">Approve</button>
          <button type="button" class="cancel-button" id="cancel">Cancel</button>
        </div>
      </form>
    </div>`;
  const close=()=>document.querySelector("#modal").innerHTML="";
  document.querySelector("#close").onclick=close;
  document.querySelector("#cancel").onclick=close;
  const supplierSelect=document.querySelector("#po-supplier");
  const supplierAddress=document.querySelector("#po-supplier-address");
  const syncSupplierAddress=()=>{
    const supplier=masters.Suppliers.find(record=>record[0]===supplierSelect.value);
    supplierAddress.value=supplier?.[1]||"";
  };
  supplierSelect.addEventListener("change",syncSupplierAddress);
  const updatePoTotals=()=>{
    let grand=0;
    document.querySelectorAll("#po-item-rows tr").forEach(row=>{
      const qty=Number(row.querySelector(".po-qty").value)||0;
      const cost=Number(row.querySelector(".po-cost").value)||0;
      const total=qty*cost;
      grand+=total;
      row.querySelector(".po-row-total").textContent=new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP",minimumFractionDigits:2}).format(total);
    });
    document.querySelector("#po-grand-total").textContent=new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP",minimumFractionDigits:2}).format(grand);
  };
  document.querySelector("#po-item-rows").addEventListener("input",updatePoTotals);
  document.querySelector("#po-item-rows").addEventListener("change",event=>{
    if(event.target.name!=="item")return;
    const item=masters.Items.find(record=>record[1]===event.target.value);
    const uomSelect=event.target.closest("tr")?.querySelector('[name="unit"]');
    if(item?.[3]&&uomSelect&&[...uomSelect.options].some(option=>option.value===item[3]))uomSelect.value=item[3];
  });
  document.querySelector("#po-item-rows").addEventListener("click",event=>{
    const removeButton=event.target.closest(".remove-po-item");
    if(!removeButton)return;
    const body=document.querySelector("#po-item-rows");
    if(body.children.length===1){
      showToast("A purchase order must contain at least one line item.","error");
      return;
    }
    removeButton.closest("tr")?.remove();
    [...body.children].forEach((row,index)=>{
      row.querySelector('input[aria-label="Item number"]').value=index+1;
      const button=row.querySelector(".remove-po-item");
      button.setAttribute("aria-label",`Delete line item ${index+1}`);
    });
    updatePoTotals();
  });
  document.querySelector("#add-po-item").onclick=()=>{
    const body=document.querySelector("#po-item-rows");
    const itemNo=body.children.length+1;
    body.insertAdjacentHTML("beforeend",`<tr><td><input aria-label="Item number" value="${itemNo}" readonly></td><td><select aria-label="Unit of measure" name="unit" required>${uomOptions()}</select></td><td><select aria-label="Item description" name="item" required><option value="">Select item from master data</option></select></td><td><input aria-label="Quantity" class="po-qty" name="qty" type="number" min="1" step="1" required></td><td><input aria-label="Unit cost" class="po-cost" name="cost" type="number" min="0" step="0.01" required></td><td><output class="po-row-total">₱0.00</output></td><td class="po-line-action"><button type="button" class="remove-po-item" aria-label="Delete line item ${itemNo}" title="Delete line item"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/></svg></button></td></tr>`);
  };
  document.querySelector("#po-form").onsubmit=e=>{
    e.preventDefault();
    const f=new FormData(e.target);
    const intent=e.submitter?.value;
    const poNumber=String(f.get("number")||"").trim();
    const poDate=String(f.get("date")||"");
    if(!poNumber||!poDate){showToast("PO number and PO date are required. The purchase order was not saved.","error");return}
    if(pos.some(record=>record[0]===poNumber)){showToast("PO number already exists. Enter a unique PO number.","error");return}
    const rows=[...document.querySelectorAll("#po-item-rows tr")];
    const items=rows.map((row,itemIndex)=>{
      const qty=Number(row.querySelector(".po-qty").value)||0;
      const unitCost=Number(row.querySelector(".po-cost").value)||0;
      const description=row.querySelector('[name="item"]').value;
      return {itemNo:itemIndex+1,uom:row.querySelector('[name="unit"]').value,description,classification:itemClassificationFromName(description),qty,unitCost,total:qty*unitCost};
    });
    const total=items.reduce((sum,item)=>sum+item.total,0);
    const status=intent==="approve"?"Completed":"Draft";
    const displayDate=new Date(`${poDate}T00:00:00`).toLocaleDateString("en-PH",{month:"long",day:"numeric",year:"numeric"});
    const record=[poNumber,displayDate,f.get("supplier"),f.get("pr")||"No PR number",f.get("mode"),total,status,false,items,f.get("supplierAddress"),"3rd Floor Esquina Dos Bldg, J.C. Aquino Ave, Butuan City",f.get("deliveryPeriod")||"",f.get("fund")];
    record.purpose=String(f.get("purpose")||"").trim();
    record.isoDate=poDate;
    pos.unshift(record);
    close();
    showToast(status==="Completed"?"Purchase order approved and ready for IAR creation.":"Purchase order saved as draft.");
    render("Purchase Orders");
  };
}

function openPOView(index){
  const r=pos[index];
  if(!r)return;
  const linkedIar=iars.find(iar=>iar[1]===r[0]);
  const items=r[8]||[];
  document.querySelector("#modal").innerHTML=`<div class="modal-backdrop"><div class="drawer po-drawer"><div class="drawer-head"><div><p>Purchase order details</p><h2>${r[0]}</h2></div><button type="button" id="close">×</button></div><div class="drawer-body"><div class="source-card"><span>PO</span><div><strong>${r[2]}</strong><p>${r[1]} · ${r[3]}</p></div>${badge(r[6])}</div><h3>PO header information</h3><div class="form-grid"><label>PO number<input value="${r[0]}" readonly></label><label>PO date<input value="${r[1]}" readonly></label><label class="wide">Supplier<input value="${r[2]}" readonly></label><label class="wide">Supplier address<textarea readonly>${r[9]||masters.Suppliers.find(s=>s[0]===r[2])?.[1]||""}</textarea></label><label>Purchase Request no.<input value="${r[3]}" readonly></label><label>Mode of procurement<input value="${r[4]}" readonly></label><label class="wide">Purpose<textarea readonly>${escapeFormValue(r.purpose||"")}</textarea></label><label class="wide">Delivery location<input value="${r[10]||"3rd Floor Esquina Dos Bldg, J.C. Aquino Ave, Butuan City"}" readonly></label><label>Delivery period<input value="${r[11]||"Not specified"}" readonly></label><label>Fund source<input value="${r[12]||"Regular Fund 01"}" readonly></label><label>IAR status<input value="${linkedIar?`${linkedIar[0]} · ${linkedIar[6]}`:r[7]?"IAR deleted — ready to unpost":"No IAR created"}" readonly></label></div><div class="po-items-heading"><div><h3>Purchase order items</h3><p>Consolidated document lines with their post-IAR unit handling.</p></div></div><div class="po-item-table-wrap"><table class="po-item-editor"><thead><tr><th>Item No.</th><th>UOM</th><th>Item Description</th><th>QTY</th><th>Unit Cost</th><th>Total Cost</th><th>After IAR approval</th></tr></thead><tbody>${items.length?items.map(item=>`<tr><td>${item.itemNo}</td><td>${item.uom}</td><td>${item.description}</td><td>${item.qty}</td><td>${peso.format(item.unitCost)}</td><td><strong>${peso.format(item.total)}</strong></td><td><strong>${unitProcessingText(item)}</strong></td></tr>`).join(""):`<tr><td colspan="7" class="muted">No saved line-item details.</td></tr>`}</tbody></table></div><div class="po-grand-total"><span>Total Purchase Order Amount</span><strong>${peso.format(r[5])}</strong></div></div><div class="drawer-foot"><button type="button" class="primary-button" id="done">Close</button></div></div></div>`;
  const close=()=>document.querySelector("#modal").innerHTML="";
  document.querySelector("#close").onclick=close;
  document.querySelector("#done").onclick=close;
}

function openPOEdit(index){
  const r=pos[index];
  if(!r)return;
  if(r[7]||iars.some(iar=>iar[1]===r[0])){showToast("This purchase order is locked because an IAR has already been created.","error");return}
  const savedItems=r[8]?.length?r[8]:[{itemNo:1,uom:"",description:"",qty:1,unitCost:0,total:0}];
  const procurementModes=masters.ProcurementModes.filter(row=>row[1]==="Active"||row[0]===r[4]).map(row=>row[0]);
  if(r[4]&&!procurementModes.includes(r[4]))procurementModes.push(r[4]);
  const uomOptions=(selected="")=>`${selected&&!masters.UOM.some(row=>row[1]===selected)?`<option value="${escapeFormValue(selected)}" selected>${escapeFormValue(selected)}</option>`:""}<option value="">Select UOM</option>${masters.UOM.map(row=>`<option value="${escapeFormValue(row[1])}" ${row[1]===selected?"selected":""}>${escapeFormValue(row[0])} (${escapeFormValue(row[1])})</option>`).join("")}`;
  const itemOptions=(selected="")=>`${selected&&!masters.Items.some(row=>row[1]===selected)?`<option value="${escapeFormValue(selected)}" selected>${escapeFormValue(selected)}</option>`:""}<option value="">Select item from master data</option>${masters.Items.map(row=>`<option value="${escapeFormValue(row[1])}" ${row[1]===selected?"selected":""}>${escapeFormValue(row[1])}</option>`).join("")}`;
  const lineRow=(item,itemNo)=>`<tr data-po-item-id="${escapeFormValue(item.dbId||"")}"><td><input aria-label="Item number" value="${itemNo}" readonly></td><td><select aria-label="Unit of measure" name="unit" required>${uomOptions(item.uom||"")}</select></td><td><select aria-label="Item description" name="item" required>${itemOptions(item.description||"")}</select></td><td><input aria-label="Quantity" class="po-qty" name="qty" type="number" value="${Number(item.qty)||1}" min="1" step="1" required></td><td><input aria-label="Unit cost" class="po-cost" name="cost" type="number" value="${Number(item.unitCost)||0}" min="0" step="0.01" required></td><td><output class="po-row-total">${peso.format((Number(item.qty)||0)*(Number(item.unitCost)||0))}</output></td><td class="po-line-action"><button type="button" class="remove-po-item" aria-label="Delete line item ${itemNo}" title="Delete line item"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/></svg></button></td></tr>`;
  document.querySelector("#modal").innerHTML=`<div class="modal-backdrop"><form class="drawer po-drawer" id="po-edit-form"><div class="drawer-head"><div><p>Edit draft purchase order</p><h2>${escapeFormValue(r[0])}</h2></div><button type="button" id="close" aria-label="Close">×</button></div><div class="drawer-body"><h3>PO header information</h3><div class="form-grid"><label>PO number <span class="required-mark">*</span><input name="number" value="${escapeFormValue(r[0])}" required><small class="field-hint">Required. Enter the official PO number manually.</small></label><label>PO date <span class="required-mark">*</span><input name="date" type="date" value="${escapeFormValue(r.isoDate||"")}" required><small class="field-hint">Required before saving or approval.</small></label><label class="wide">Supplier <span class="required-mark">*</span><select id="edit-po-supplier" name="supplier" required><option value="">Select supplier from master data</option>${masters.Suppliers.filter(s=>s[5]==="Active"||s[0]===r[2]).map(s=>`<option value="${escapeFormValue(s[0])}" ${s[0]===r[2]?"selected":""}>${escapeFormValue(s[0])}</option>`).join("")}</select></label><label class="wide">Supplier address<textarea id="edit-po-address" name="supplierAddress" readonly></textarea><small class="field-hint">Linked to the supplier master record. Edit this address under Admin Options → Suppliers.</small></label><label>Purchase Request no. <span class="optional-mark">Optional</span><input name="pr" value="${escapeFormValue(r[3]==="No PR number"?"":r[3])}" placeholder="May be left blank"></label><label>Mode of procurement <span class="required-mark">*</span><select name="mode" required><option value="">Select mode under RA 12009</option>${procurementModes.map(mode=>`<option ${mode===r[4]?"selected":""}>${escapeFormValue(mode)}</option>`).join("")}</select></label><label class="wide">Purpose <span class="optional-mark">Optional</span><textarea name="purpose" placeholder="Enter the purpose of this purchase order">${escapeFormValue(r.purpose||"")}</textarea></label><label class="wide">Delivery location<input value="${escapeFormValue(r[10]||"3rd Floor Esquina Dos Bldg, J.C. Aquino Ave, Butuan City")}" readonly><small class="field-hint">Permanent delivery location</small></label><label>Delivery period<input name="deliveryPeriod" value="${escapeFormValue(r[11]||"")}" placeholder="15 calendar days"></label><label>Fund source<select name="fund"><option ${r[12]==="Regular Fund 01"||!r[12]?"selected":""}>Regular Fund 01</option></select></label></div><div class="po-items-heading"><div><h3>Purchase order items</h3><p>Edit the saved lines, add another item, or remove a line before saving the draft or approving it.</p></div><div class="po-items-heading-actions"><button type="button" id="add-edit-po-master-item">＋ New master item</button><button type="button" id="add-edit-po-item">＋ Add line</button></div></div><div class="po-item-table-wrap"><table class="po-item-editor"><thead><tr><th>Item No.</th><th>UOM</th><th>Item Description</th><th>QTY</th><th>Unit Cost</th><th>Total Cost</th><th class="po-line-action-heading"><span class="sr-only">Actions</span></th></tr></thead><tbody id="edit-po-item-rows">${savedItems.map((item,itemIndex)=>lineRow(item,itemIndex+1)).join("")}</tbody></table></div><div class="notice-note"><strong>Consolidated-to-unit rule:</strong> Accepted Semi-Expendable and Capital Outlay quantities will still split into separately accountable property units after IAR approval.</div><div class="po-grand-total"><span>Total Purchase Order Amount</span><strong id="edit-po-grand-total">${peso.format(savedItems.reduce((sum,item)=>sum+(Number(item.qty)||0)*(Number(item.unitCost)||0),0))}</strong></div></div><div class="drawer-foot po-actions"><button class="secondary-button" name="intent" value="draft">Save as Draft</button><button class="primary-button" name="intent" value="approve">Approve</button><button type="button" class="cancel-button" id="cancel">Cancel</button></div></form></div>`;
  const close=()=>document.querySelector("#modal").innerHTML="";
  document.querySelector("#close").onclick=close;
  document.querySelector("#cancel").onclick=close;
  const supplier=document.querySelector("#edit-po-supplier");
  const address=document.querySelector("#edit-po-address");
  const sync=()=>address.value=masters.Suppliers.find(s=>s[0]===supplier.value)?.[1]||r[9]||"";
  supplier.onchange=sync;
  sync();
  const updateTotals=()=>{
    let grand=0;
    document.querySelectorAll("#edit-po-item-rows tr").forEach(row=>{
      const total=(Number(row.querySelector(".po-qty").value)||0)*(Number(row.querySelector(".po-cost").value)||0);
      grand+=total;
      row.querySelector(".po-row-total").textContent=peso.format(total);
    });
    document.querySelector("#edit-po-grand-total").textContent=peso.format(grand);
  };
  const rowsBody=document.querySelector("#edit-po-item-rows");
  rowsBody.addEventListener("input",updateTotals);
  rowsBody.addEventListener("change",event=>{
    if(event.target.name!=="item")return;
    const item=masters.Items.find(record=>record[1]===event.target.value);
    const uomSelect=event.target.closest("tr")?.querySelector('[name="unit"]');
    if(item?.[3]&&uomSelect&&[...uomSelect.options].some(option=>option.value===item[3]))uomSelect.value=item[3];
  });
  rowsBody.addEventListener("click",event=>{
    const removeButton=event.target.closest(".remove-po-item");
    if(!removeButton)return;
    if(rowsBody.children.length===1){showToast("A purchase order must contain at least one line item.","error");return}
    removeButton.closest("tr")?.remove();
    [...rowsBody.children].forEach((row,rowIndex)=>{
      row.querySelector('input[aria-label="Item number"]').value=rowIndex+1;
      row.querySelector(".remove-po-item").setAttribute("aria-label",`Delete line item ${rowIndex+1}`);
    });
    updateTotals();
  });
  document.querySelector("#add-edit-po-item").onclick=()=>{
    const itemNo=rowsBody.children.length+1;
    rowsBody.insertAdjacentHTML("beforeend",lineRow({uom:"",description:"",qty:1,unitCost:0},itemNo));
  };
  document.querySelector("#po-edit-form").onsubmit=e=>{
    e.preventDefault();
    const f=new FormData(e.target);
    const number=String(f.get("number")).trim();
    if(pos.some((po,poIndex)=>poIndex!==index&&po[0]===number)){showToast("PO number already exists.","error");return}
    const items=[...rowsBody.querySelectorAll("tr")].map((row,itemIndex)=>{
      const qty=Number(row.querySelector(".po-qty").value)||0;
      const unitCost=Number(row.querySelector(".po-cost").value)||0;
      const description=row.querySelector('[name="item"]').value;
      return {dbId:row.dataset.poItemId||undefined,itemNo:itemIndex+1,uom:row.querySelector('[name="unit"]').value,description,classification:itemClassificationFromName(description),qty,unitCost,total:qty*unitCost};
    });
    r[0]=number;
    r.isoDate=String(f.get("date")).trim();
    r[1]=new Date(`${r.isoDate}T00:00:00`).toLocaleDateString("en-PH",{month:"long",day:"numeric",year:"numeric"});
    r[2]=f.get("supplier");
    r[3]=String(f.get("pr")).trim()||"No PR number";
    r[4]=String(f.get("mode")).trim();
    r[5]=items.reduce((sum,item)=>sum+item.total,0);
    r[6]=e.submitter?.value==="approve"?"Completed":"Draft";
    r[8]=items;
    r[9]=String(f.get("supplierAddress")||"");
    r[10]="3rd Floor Esquina Dos Bldg, J.C. Aquino Ave, Butuan City";
    r[11]=String(f.get("deliveryPeriod")||"");
    r[12]=String(f.get("fund")||"Regular Fund 01");
    r.purpose=String(f.get("purpose")||"").trim();
    close();
    showToast(r[6]==="Completed"?"Purchase order updated and approved.":"Purchase order draft updated.");
    render("Purchase Orders");
  };
}

function deletePO(index){
  const r=pos[index];
  if(!r)return;
  if(r[7]||iars.some(iar=>iar[1]===r[0])){showToast("This purchase order cannot be deleted after an IAR has been created. Delete the IAR, then unpost the PO first.","error");return}
  if(!confirm(`Delete ${r[0]}? This action removes the purchase order record.`))return;
  pos.splice(index,1);
  showToast("Purchase order deleted.");
  render("Purchase Orders");
}

function unpostPO(index){
  const r=pos[index];
  if(!r)return;
  if(r[6]!=="Completed"){showToast("Only a completed purchase order can be unposted.","error");return}
  const linkedIar=iars.find(iar=>iar[1]===r[0]);
  if(linkedIar){showToast(`Delete ${linkedIar[0]} before unposting ${r[0]}.`,"error");return}
  if(!confirm(`Unpost ${r[0]} and return it to Draft?`))return;
  r[6]="Draft";
  r[7]=false;
  showToast("Purchase order unposted and returned to Draft.");
  render("Purchase Orders");
}

function openIARForm(poIndex){
  const po=pos[poIndex];
  if(!po)return;
  if(po[7]||iars.some(iar=>iar[1]===po[0])){showToast("An IAR already exists for this purchase order.","error");return}
  const items=po[8]||[];
  document.querySelector("#modal").innerHTML=`<div class="modal-backdrop"><form class="drawer po-drawer" id="iar-create-form"><div class="drawer-head"><div><p>Create from ${po[0]}</p><h2>Inspection and Acceptance Report</h2></div><button type="button" id="close">×</button></div><div class="drawer-body"><div class="source-card"><span>PO</span><div><strong>${po[0]} · ${po[2]}</strong><p>${items.length} purchase order item${items.length===1?"":"s"} · ${peso.format(po[5])}</p></div>${badge(po[6])}</div><h3>IAR header information</h3><div class="form-grid"><label>IAR number <span class="required-mark">*</span><input name="number" placeholder="Enter IAR number manually" required><small class="field-hint">Required. The IAR number is not automatically generated.</small></label><label>IAR date <span class="required-mark">*</span><input name="date" type="date" required></label><label>Invoice No. <span class="optional-mark">Optional</span><input name="invoiceNumber" placeholder="Enter supplier invoice number"></label><label>Invoice Date <span class="optional-mark">Optional</span><input name="invoiceDate" type="date"></label><label>PO number<input value="${po[0]}" readonly></label><label>Supplier<input value="${po[2]}" readonly></label></div><div class="po-items-heading"><div><h3>Items from the purchase order</h3><p>Lines stay consolidated in the IAR; accepted property quantities split 1:1 after approval.</p></div></div><div class="po-item-table-wrap"><table class="po-item-editor"><thead><tr><th>Item No.</th><th>UOM</th><th>Item Description</th><th>Ordered QTY</th><th>Unit Cost</th><th>Total Cost</th><th>After approval</th></tr></thead><tbody>${items.length?items.map(item=>`<tr><td>${item.itemNo}</td><td>${item.uom}</td><td>${item.description}</td><td>${item.qty}</td><td>${peso.format(item.unitCost)}</td><td><strong>${peso.format(item.total)}</strong></td><td><strong>${unitProcessingText(item)}</strong></td></tr>`).join(""):`<tr><td colspan="7" class="muted">No saved line-item details.</td></tr>`}</tbody></table></div><div class="notice-note">Semi‑Expendable and Capital Outlay quantities become one separately numbered property record per accepted unit. Expendables remain quantity-based stock.</div></div><div class="drawer-foot"><button type="button" class="secondary-button" id="cancel">Cancel</button><button class="primary-button">Save IAR draft</button></div></form></div>`;
  const close=()=>document.querySelector("#modal").innerHTML="";
  document.querySelector("#close").onclick=close;
  document.querySelector("#cancel").onclick=close;
  document.querySelector("#iar-create-form").onsubmit=e=>{
    e.preventDefault();
    const f=new FormData(e.target);
    const number=String(f.get("number")).trim();
    if(iars.some(iar=>iar[0]===number)){showToast("IAR number already exists. Enter a unique IAR number.","error");return}
    const rawDate=String(f.get("date"));
    const displayDate=new Date(`${rawDate}T00:00:00`).toLocaleDateString("en-PH",{month:"long",day:"numeric",year:"numeric"});
    const orderedQty=items.reduce((sum,item)=>sum+Number(item.qty||0),0);
    po[7]=true;
    const invoiceDateRaw=String(f.get("invoiceDate")||"");
    const record=[number,po[0],po[2],displayDate,`0 / ${orderedQty}`,"Upon completion","Draft",items.map(item=>({...item}))];
    record.invoiceNo=String(f.get("invoiceNumber")||"").trim();
    record.invoiceDate=invoiceDateRaw?new Date(`${invoiceDateRaw}T00:00:00`).toLocaleDateString("en-PH",{month:"long",day:"numeric",year:"numeric"}):"";
    iars.unshift(record);
    close();
    showToast("IAR draft created. Its number and PO item details were saved.");
    render("Inspection & Acceptance");
  };
}

function openIARView(index){
  const r=iars[index];
  if(!r)return;
  const po=pos.find(po=>po[0]===r[1]);
  const items=r[7]||po?.[8]||[];
  document.querySelector("#modal").innerHTML=`<div class="modal-backdrop"><div class="drawer po-drawer"><div class="drawer-head"><div><p>Inspection and acceptance report</p><h2>${r[0]}</h2></div><button type="button" id="close">×</button></div><div class="drawer-body"><div class="source-card"><span>IA</span><div><strong>${r[2]}</strong><p>PO No. ${r[1]} · ${r[3]}</p></div>${badge(r[6])}</div><h3>IAR header information</h3><div class="form-grid"><label>IAR number<input value="${r[0]}" readonly></label><label>IAR date<input value="${r[3]}" readonly></label><label>Invoice No.<input value="${r.invoiceNo||""}" readonly></label><label>Invoice Date<input value="${r.invoiceDate||""}" readonly></label><label>PO number<input value="${r[1]}" readonly></label><label>Supplier name<input value="${r[2]}" readonly></label><label>Classification<input value="${r[5]}" readonly></label></div><div class="po-items-heading"><div><h3>Items from the purchase order</h3><p>Consolidated IAR lines and their resulting inventory/property records.</p></div></div><div class="po-item-table-wrap"><table class="po-item-editor"><thead><tr><th>Item No.</th><th>UOM</th><th>Item Description</th><th>Accepted QTY</th><th>Unit Cost</th><th>Total Cost</th><th>Unit handling</th></tr></thead><tbody>${items.length?items.map(item=>`<tr><td>${item.itemNo}</td><td>${item.uom}</td><td>${item.description}</td><td>${item.qty}</td><td>${peso.format(item.unitCost)}</td><td><strong>${peso.format(item.total)}</strong></td><td><strong>${unitProcessingText(item)}</strong><small>${r[6]==="Completed"?"Created on IAR approval":"Will be created on approval"}</small></td></tr>`).join(""):`<tr><td colspan="7" class="muted">No saved line-item details.</td></tr>`}</tbody></table></div><div class="po-grand-total"><span>Source Purchase Order Amount</span><strong>${peso.format(po?.[5]||items.reduce((sum,item)=>sum+Number(item.total||0),0))}</strong></div></div><div class="drawer-foot"><button type="button" class="primary-button" id="done">Close</button></div></div></div>`;
  const close=()=>document.querySelector("#modal").innerHTML="";
  document.querySelector("#close").onclick=close;
  document.querySelector("#done").onclick=close;
}

function deleteIAR(index){
  const r=iars[index];
  if(!r)return;
  if(r[6]==="Completed"){showToast("Unpost the completed IAR before deleting it.","error");return}
  if(!confirm(`Delete ${r[0]}? The linked purchase order will then become eligible for unposting.`))return;
  iars.splice(index,1);
  showToast(`${r[0]} deleted. ${r[1]} can now be unposted from Purchase Orders.`);
  render("Inspection & Acceptance");
}

function unpostIAR(index){
  const r=iars[index];
  if(!r||r[6]!=="Completed")return;
  if(!confirm(`Unpost ${r[0]}? Its inventory receipt will be reversed and the IAR will return to Draft status.`))return;
  r[6]="Draft";
  r[5]="Upon completion";
  showToast(`${r[0]} unposted. Its inventory receipt was reversed.`);
  render("Inspection & Acceptance");
}

function enhancedRIS(){
  const completed=risRecords.filter(r=>r.status==="Completed").length;
  return `<section class="page-heading"><div><h2>Requisition and Issue Slips</h2><p>Request and issue expendable supplies using first-in, first-out inventory costing.</p></div><button class="primary-button" id="new-ris-form">＋ Create RIS</button></section>
  <section class="mini-stats"><div><span>All RIS records</span><strong>${risRecords.length}</strong></div><div><span>Completed this month</span><strong>${completed}</strong></div><div><span>Eligible for RSMI</span><strong>${risRecords.filter(r=>r.status==="Completed"&&!r.inRsmi).length}</strong></div><div><span>Issued value</span><strong>${peso.format(risRecords.reduce((a,r)=>a+r.value,0))}</strong></div></section>
  <section class="panel"><div class="toolbar toolbar-wrap"><label class="search">⌕<input id="ris-search" placeholder="Search RIS number, office, or employee…"></label><div><select id="ris-status"><option>All statuses</option><option>Draft</option><option>Completed</option><option>Cancelled</option></select><button class="secondary-button" data-export="ris">⇩ CSV</button><button class="secondary-button" data-print>Print</button></div></div><div id="ris-table">${risTable(risRecords)}</div></section>
  <section class="info-banner"><span>i</span><div><strong>FIFO and duplicate-processing protection</strong><p>Completing an RIS allocates the oldest available batches first, records every cost layer, updates balances, and prevents the same lines from being processed again.</p></div><button data-go="RSMI Generation">Open RSMI →</button></section>`;
}
function risTable(rows){
  if(!rows.length)return `<div class="empty-state"><span>RI</span><h3>No RIS records found</h3><p>Adjust the filters or create a new requisition and issue slip.</p></div>`;
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>RIS number</th><th>Date</th><th>Requesting office</th><th>Requested by</th><th>Purpose</th><th>Items</th><th>Issued value</th><th>Status</th><th>RSMI</th><th>Actions</th></tr></thead><tbody>${rows.map(r=>{const i=risRecords.indexOf(r);const draft=r.status==="Draft";return `<tr><td><strong class="linkish">${r.number}</strong></td><td>${r.date}</td><td><strong>${r.office}</strong></td><td>${r.requestedBy}</td><td>${r.purpose}</td><td>${r.items}</td><td><strong>${r.value?peso.format(r.value):"—"}</strong></td><td>${badge(r.status)}</td><td>${r.inRsmi?`<span class="class-tag expendable">Included</span>`:`<span class="muted">Not included</span>`}</td><td><div class="row-actions">${draft?`<button data-edit-ris="${i}">Edit</button><button data-complete-ris="${i}">Complete</button><button data-delete-ris="${i}">Delete</button>`:`<button data-unpost-ris="${i}">Unpost</button>`}<button data-view-ris="${i}">View</button><button data-ris-print="${i}">Print</button></div></td></tr>`}).join("")}</tbody></table></div><div class="pagination"><span>Showing 1–${rows.length} of ${rows.length} RIS records</span><div><button disabled>‹</button><button class="active">1</button><button>›</button></div></div>`;
}

function propertyRecordsView(){
  const classificationOptions=[
    {name:"Semi-Expendable",code:"SE",tone:"violet",description:"View all semi-expendable property units regardless of UACS category."},
    {name:"Capital Outlay",code:"CO",tone:"navy",description:"View all capital-outlay property units regardless of UACS category."}
  ];
  if(!propertyRecordsMode)return `<section class="page-heading"><div><h2>Property Records</h2><p>Choose which property master list you want to open.</p></div></section><section class="property-choice-grid">${classificationOptions.map(option=>{const units=propertyUnits.filter(unit=>unit.classification===option.name);return `<button class="property-choice-card" data-property-classification="${option.name}"><span class="metric-icon ${option.tone}">${option.code}</span><div><h3>${option.name}</h3><p>${option.description}</p><strong>${units.length} unit${units.length===1?"":"s"}</strong><small>${peso.format(units.reduce((sum,unit)=>sum+Number(unit.cost||0),0))} acquisition value</small></div><b>Open master list →</b></button>`}).join("")}</section>`;
  const selectedUnits=propertyUnits.filter(unit=>unit.classification===propertyRecordsMode);
  const selectedOption=classificationOptions.find(option=>option.name===propertyRecordsMode)||classificationOptions[0];
  return `<section class="page-heading"><div><button class="property-back-button" data-property-back>← Property Records</button><h2>${selectedOption.name}</h2><p>Showing all ${selectedOption.name.toLowerCase()} units regardless of category.</p></div><div><button class="secondary-button" data-export="property">⇩ CSV</button> <button class="secondary-button" data-print>Print list</button></div></section>
  <section class="property-summary"><article><span class="metric-icon ${selectedOption.tone}">${selectedOption.code}</span><div><p>${selectedOption.name}</p><strong>${selectedUnits.length} units</strong><small>${peso.format(selectedUnits.reduce((sum,p)=>sum+Number(p.cost||0),0))} acquisition value</small></div></article><article><span class="metric-icon amber">MI</span><div><p>Missing identifiers</p><strong>${selectedUnits.filter(p=>(p.classification==="Semi-Expendable"?!p.inventoryNumber:!p.number)||!p.serial).length} units</strong><small>Property/inventory or serial number required</small></div></article></section>
  <section class="panel"><div class="toolbar toolbar-wrap"><label class="search">⌕<input id="property-search" placeholder="Search property/inventory no., item, brand, model, serial, or employee…"></label><div><select id="property-status"><option>All statuses</option><option>Available</option><option>Issued</option><option>Under Repair</option><option>Returned</option><option>Unserviceable</option><option>Transferred</option><option>Disposed</option></select></div></div><div id="property-table">${propertyTable(selectedUnits,selectedUnits.length)}</div></section>`;
}
function propertyTable(rows,total=rows.length){
  if(!rows.length)return `<div class="empty-state"><span>PR</span><h3>No property units match</h3><p>Change the search or filters to see more individual units.</p></div>`;
  return `<div class="table-wrap property-table-wrap"><table class="data-table"><thead><tr><th>Property / Inventory No.</th><th>Item</th><th>Brand</th><th>Model</th><th>Serial No.</th><th>PPE No.</th><th>Acquisition</th><th>Issued to</th><th>Condition</th><th>Actions</th></tr></thead><tbody>${rows.map(p=>{const i=propertyUnits.indexOf(p);const semi=p.classification==="Semi-Expendable";const identifier=semi?p.inventoryNumber:p.number;return `<tr><td>${identifier?`<strong class="linkish">${escapeFormValue(identifier)}</strong>`:`<span class="missing-value">${semi?"Pending inventory no.":"Pending property no."}</span>`}</td><td><strong>${escapeFormValue(p.item||"—")}</strong></td><td>${escapeFormValue(p.brand||"—")}</td><td>${escapeFormValue(p.model||"—")}</td><td>${escapeFormValue(p.serial||"Not entered")}</td><td>${p.number?`<strong>${escapeFormValue(p.number)}</strong>`:`<span class="missing-value">Pending PPE no.</span>`}</td><td><strong>${peso.format(p.cost)}</strong><small>${escapeFormValue(p.date)}</small></td><td>${escapeFormValue(p.employee||"Unassigned")}<small>${escapeFormValue(p.position||p.office||"—")}</small></td><td>${escapeFormValue(p.condition||"—")}</td><td class="property-actions-cell"><div class="property-actions-menu"><button class="property-actions-trigger" data-property-menu="${i}" aria-label="Open property actions" aria-expanded="false">⋮</button><div class="property-actions-popover" data-property-menu-panel="${i}" hidden><button data-generate-property-qr="${i}">Generate QR</button><button data-edit-property="${i}">${semi?"Edit ICS":"Edit property unit"}</button>${semi?`<button data-view-ics="${i}" ${p.icsNumber?"":`disabled title="No generated ICS is available for this record"`}>View ICS</button>`:`<button data-view-par="${i}">View PAR</button>`}<button data-transfer-property="${i}">Transfer</button><button data-unserviceable-property="${i}" ${p.status==="Unserviceable"?"disabled":""}>Unserviceable</button></div></div></td></tr>`}).join("")}</tbody></table></div><div class="pagination"><span>Showing ${rows.length?`1–${rows.length}`:"0"} of ${total} property units</span><div><button disabled>‹</button><button class="active">1</button><button>›</button></div></div>`;
}

function propertyQrPayload(property,index){
  const permanentId=String(property.dbId||property.inventoryNumber||property.number||`legacy-${index}`).trim();
  return `sinop://property/${encodeURIComponent(permanentId)}`;
}

function openPropertyQr(index){
  const property=propertyUnits[index];
  if(!property)return;
  const tenant=readTenantSettings();
  const identifier=property.classification==="Semi-Expendable"?(property.inventoryNumber||property.number):(property.number||property.inventoryNumber);
  const payload=propertyQrPayload(property,index);
  const filename=`${identifier||property.item||"property-unit"}-qr`.replace(/[^a-z0-9_-]+/gi,"-");
  document.querySelector("#modal").innerHTML=`<div class="modal-backdrop qr-modal-backdrop"><section class="qr-modal" role="dialog" aria-modal="true" aria-labelledby="qr-modal-title"><div class="qr-modal-head no-print"><div><p>Physical count label</p><h2 id="qr-modal-title">Property QR Code</h2></div><button type="button" id="close-property-qr" aria-label="Close">×</button></div><div class="qr-label-preview"><div class="qr-label-agency"><strong>${escapeFormValue(tenant.agencyName||"Your Agency")}</strong><small>Inventory and Property Management</small></div><canvas id="property-qr-canvas" width="260" height="260" aria-label="QR code for ${escapeFormValue(identifier||property.item)}"></canvas><div class="qr-label-details"><strong>${escapeFormValue(property.item||"Property unit")}</strong><span>${escapeFormValue(identifier||"Identifier pending")}</span><small>${escapeFormValue([property.brand,property.model].filter(Boolean).join(" · ")||property.classification)}</small><small>${escapeFormValue(property.serial?`Serial No.: ${property.serial}`:property.classification)}</small></div></div><p class="qr-security-note no-print"><strong>Secure lookup:</strong> The QR contains only the unit’s permanent Sinop reference. Property details remain protected behind an authorized login.</p><div class="qr-modal-actions no-print"><button class="secondary-button" id="download-property-qr" type="button">Download PNG</button><button class="primary-button" id="print-property-qr" type="button">Print QR label</button></div></section></div>`;
  const close=()=>{document.querySelector("#modal").innerHTML=""};
  document.querySelector("#close-property-qr").onclick=close;
  document.querySelector(".qr-modal-backdrop").addEventListener("click",event=>{if(event.target===event.currentTarget)close()});
  const canvas=document.querySelector("#property-qr-canvas");
  if(!window.QRCode?.toCanvas){showToast("QR generator could not be loaded.","error");close();return}
  window.QRCode.toCanvas(canvas,payload,{width:260,margin:2,errorCorrectionLevel:"M",color:{dark:"#10232F",light:"#FFFFFF"}},error=>{if(error){showToast("QR code could not be generated.","error");close()}});
  document.querySelector("#download-property-qr").onclick=()=>{const link=document.createElement("a");link.download=`${filename}.png`;link.href=canvas.toDataURL("image/png");link.click()};
  document.querySelector("#print-property-qr").onclick=()=>window.print();
}

function normalizedPropertyCondition(value){
  if(value==="Unserviceable")return "Unserviceable";
  if(value==="Repair"||value==="Under Repair")return "Repair";
  return "Serviceable";
}

function nextParNumber(year=new Date().getFullYear()){
  const highest=propertyUnits.reduce((maximum,unit)=>{
    if(unit.classification!=="Capital Outlay")return maximum;
    const match=String(unit.parNumber||"").toUpperCase().match(/^(\d{4})-(\d{3})(\d|[A-Z])$/);
    if(!match||Number(match[1])!==Number(year))return maximum;
    const numericPart=Number(`${match[2]}${/[0-9]/.test(match[3])?match[3]:""}`);
    return Math.max(maximum,numericPart||0);
  },0);
  return `${year}-${String(highest+1).padStart(4,"0")}`;
}

function transferProperty(index){
  const property=propertyUnits[index];
  if(!property)return;
  ptrSelectedKeys=[String(property.dbId||index)];
  formTab="Appendix 76 (PTR)";
  render("Forms");
}

function markPropertyUnserviceable(index){
  const property=propertyUnits[index];
  if(!property||property.status==="Unserviceable")return;
  const identifier=property.inventoryNumber||property.number||property.item;
  if(!confirm(`Mark ${identifier} as unserviceable?`))return;
  property.status="Unserviceable";
  property.condition="Unserviceable";
  showToast(`${identifier} marked as unserviceable.`);
  render("Property Records");
}

function nextRsmiNumber(dateValue=localISODate()){
  const year=Number(String(dateValue).slice(0,4))||new Date().getFullYear();
  const highest=rsmiRecords.reduce((max,record)=>{
    const match=String(record.number||"").match(/^(\d{4})-(\d{3,})$/);
    return match&&Number(match[1])===year?Math.max(max,Number(match[2])):max;
  },0);
  return `${year}-${String(highest+1).padStart(3,"0")}`;
}

function rsmiCategoryOptions(){
  const categories=new Set(masters.UACS.filter(row=>row[2]==="Expendable"&&row[5]!=="Inactive").map(row=>row[1]).filter(Boolean));
  masters.Items.filter(item=>item[6]==="Expendable").forEach(item=>{
    const uacs=masters.UACS.find(row=>row[0]===item[4]);
    if(uacs?.[1])categories.add(uacs[1]);
  });
  return [...categories].sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:"base",numeric:true}));
}

function rsmiEmployeeOptions(selected=""){
  return masters.Employees.filter(row=>row[5]!=="Inactive").map(row=>`<option value="${escapeFormValue(row[1])}" ${row[1]===selected?"selected":""}>${escapeFormValue(row[1])}</option>`).join("");
}

function rsmiEmployeePosition(name){
  return masters.Employees.find(row=>row[1]===name)?.[2]||"";
}

function risLineCategory(line){
  if(line.rsmiClassification)return line.rsmiClassification;
  const item=masters.Items.find(row=>String(row[0])===String(line.stockNumber||"")||row[1]===line.description||row[1]===line.generalName);
  const uacs=masters.UACS.find(row=>row[0]===(line.uacsCode||item?.[4]));
  return uacs?.[1]||"";
}

function rsmiMatchingRecords(classification,from,to){
  return risRecords.filter(record=>{
    if(record.status!=="Completed"||record.inRsmi)return false;
    const date=String(record.isoDate||"");
    if(!date||date<from||date>to)return false;
    return (record.lines||[]).some(line=>risLineCategory(line)===classification);
  });
}

function rsmiCategoryValue(record,classification){
  return (record.lines||[]).filter(line=>risLineCategory(line)===classification).reduce((sum,line)=>sum+(Number(line.totalCost)||Number(line.qty||line.issuedQty||0)*Number(line.unitCost||0)),0);
}

function rsmiPreviewMarkup(classification,from,to){
  const matches=classification&&from&&to&&from<=to?rsmiMatchingRecords(classification,from,to):[];
  return matches.length?matches.map(record=>{
    const lines=(record.lines||[]).filter(line=>risLineCategory(line)===classification);
    return `<div class="rsmi-auto-record"><span><strong>${record.number} · ${record.office}</strong><small>${record.date} · ${lines.length} matching item${lines.length===1?"":"s"}</small></span><b>${peso.format(rsmiCategoryValue(record,classification))}</b></div>`;
  }).join(""):`<div class="empty-state compact"><h3>No matching completed RIS</h3><p>Choose a classification and date range containing completed RIS transactions.</p></div>`;
}

function rsmiGenerationView(){
  const today=localISODate();
  const from=`${today.slice(0,7)}-01`;
  const categories=rsmiCategoryOptions();
  const classification=categories[0]||"";
  const eligible=classification?rsmiMatchingRecords(classification,from,today):[];
  const total=eligible.reduce((sum,record)=>sum+rsmiCategoryValue(record,classification),0);
  return `<section class="page-heading"><div><h2>RSMI</h2><p>Automatically collect completed RIS transactions by classification and inclusive date range.</p></div><button class="secondary-button" data-go="Reports">← Reports</button></section>
  <section class="rsmi-layout"><article class="panel rsmi-builder"><div class="panel-heading"><div><h3>New RSMI</h3><p>No manual RIS selection is needed.</p></div><span class="count-pill" id="rsmi-match-count">${eligible.length} matched</span></div><div class="rsmi-form"><div class="rsmi-number-row"><label>RSMI number<input id="rsmi-number" value="${nextRsmiNumber(from)}" readonly></label><small>Automatically assigned in YYYY-XXX format and resets every year.</small></div><div class="rsmi-filter-grid"><label class="rsmi-classification-field"><span>RSMI</span><select id="rsmi-classification" required><option value="">Select classification</option>${categories.map(value=>`<option value="${escapeFormValue(value)}" ${value===classification?"selected":""}>${escapeFormValue(value)}</option>`).join("")}</select></label><label><span>From</span><input id="rsmi-from" type="date" value="${from}" required></label><label><span>To</span><input id="rsmi-to" type="date" value="${today}" required></label></div><div class="rsmi-signatory-inputs"><div><h3>Certified by</h3><label>Supply and/or Property Custodian<select id="rsmi-certified-by" required><option value="">Select employee</option>${rsmiEmployeeOptions()}</select></label><p id="rsmi-certified-position">Position will appear here</p><label>Signatory date<input id="rsmi-certified-date" type="date" required></label></div><div><h3>Posted by</h3><label>Designated Accounting Staff<select id="rsmi-posted-by" required><option value="">Select employee</option>${rsmiEmployeeOptions()}</select></label><p id="rsmi-posted-position">Position will appear here</p><label>Signatory date<input id="rsmi-posted-date" type="date" required></label></div></div><p class="rsmi-date-note">Signatory dates are intentionally blank and must be entered manually.</p><div class="select-heading"><div><h3>Automatically included Completed RIS</h3><p>Only matching item lines within the selected classification and dates are counted.</p></div></div><div class="select-list" id="rsmi-auto-list">${rsmiPreviewMarkup(classification,from,today)}</div><div class="rsmi-total"><span>Automatically selected issue value</span><strong id="rsmi-total">${peso.format(total)}</strong></div><button class="primary-button full-button" id="generate-rsmi" ${eligible.length?"":"disabled"}>Generate and finalize RSMI</button></div></article>
  <article class="panel"><div class="panel-heading"><div><h3>Previously generated RSMIs</h3><p>Finalized reports and automatically included RIS records.</p></div><button class="secondary-button" data-export="rsmi">⇩ CSV</button></div><div class="rsmi-history">${rsmiRecords.length?rsmiRecords.map((r,index)=>`<div class="history-card"><div><span class="class-tag capital">${r.status}</span><h3>${r.number}</h3><p>${r.classification?`${r.classification} · `:""}${r.period} · Prepared ${r.prepared}</p></div><strong>${peso.format(r.value)}</strong><small>${r.ris.length} RIS record${r.ris.length===1?"":"s"}: ${r.ris.join(", ")}</small><div><button class="secondary-button" data-view-rsmi="${index}">View form</button><button class="secondary-button" data-print-rsmi="${index}">Print</button></div></div>`).join(""):`<div class="empty-state compact"><h3>No generated RSMI yet</h3><p>Your finalized RSMIs will appear here.</p></div>`}</div></article></section>`;
}

function enhancedAdmin(){
  const tabs=[...(window.inventoryAccess?.isSuperAdmin?["Users","Activity Log"]:[]),"Suppliers","Items","Categories","Employees","Plantilla","Departments","UOM","Procurement Modes","UACS","System Settings"];
  const singular={Suppliers:"supplier",Items:"item",Categories:"category",Employees:"employee",Plantilla:"position",UOM:"UOM","Procurement Modes":"procurement mode",UACS:"UACS account","System Settings":"setting"}[adminTab];
  const addButton=["Employees","Plantilla","Departments","Users","Activity Log","System Settings"].includes(adminTab)?"":`<button class="primary-button" id="add-master">＋ Add ${singular}</button>`;
  return `<section class="page-heading"><div><h2>Admin Options</h2><p>Maintain the configurable master data used by documents, classifications, and reports.</p></div>${addButton}</section><div class="module-tabs">${tabs.map(t=>`<button class="${adminTab===t?"active":""}" data-admin-tab="${t}">${t}</button>`).join("")}</div>${adminContent()}`;
}
function adminContent(){
  if(adminTab==="Users"){
    const profiles=window.inventoryUserProfiles||[];
    const currentUserId=window.inventoryAccess?.profile?.id||"";
    return `<section class="panel"><div class="panel-heading"><div><h3>User access</h3><p>New homepage registrations appear as Pending until you assign their role and activate them.</p></div><span class="count-pill">${profiles.length} account${profiles.length===1?"":"s"}</span></div><div class="notice-note"><strong>Permissions:</strong> Super Admin controls all actions and users. Staff can create, edit, save drafts, approve, complete, and generate reports, but cannot delete or unpost. Viewer has general read-only access and does not require an employee link.</div><div class="table-wrap"><table class="data-table"><thead><tr><th>User</th><th>Role</th><th>Access</th><th>Action</th></tr></thead><tbody>${profiles.map(profile=>{const isSelf=profile.id===currentUserId;return `<tr data-profile-row="${escapeFormValue(profile.id)}"><td><strong>${escapeFormValue(profile.full_name||profile.email)}</strong><small>${escapeFormValue(profile.email)}</small>${isSelf?`<span class="class-tag expendable">You</span>`:""}</td><td><select data-profile-role ${isSelf?"disabled":""}><option value="pending" ${profile.role==="pending"?"selected":""}>Pending</option><option value="super_admin" ${profile.role==="super_admin"?"selected":""}>Super Admin</option><option value="staff" ${profile.role==="staff"?"selected":""}>Staff</option><option value="viewer" ${profile.role==="viewer"?"selected":""}>Viewer</option></select></td><td><label class="inline-check"><input type="checkbox" data-profile-active ${profile.active?"checked":""} ${isSelf?"disabled":""}> Active</label></td><td><button class="secondary-button compact-button" data-save-profile="${escapeFormValue(profile.id)}" ${isSelf?"disabled":""}>Save</button></td></tr>`}).join("")}</tbody></table></div>${profiles.length?"":`<div class="empty-state compact"><h3>No user profiles yet</h3><p>New registrations will appear here for approval.</p></div>`}</section>`;
  }
  if(adminTab==="Activity Log"){
    const logs=(window.inventoryAuditLogs||[]).map(log=>({
      ...log,
      module:log.entity_type||"System",
      action:log.action_type||"Activity",
      userName:log.performed_by||log.user_email||"System",
      role:String(log.user_role||"system").replaceAll("_"," "),
      description:log.reason||`${log.entity_type||"Record"} ${log.reference_number||""} — ${log.action_type||"updated"}`
    }));
    const modules=[...new Set(logs.map(log=>log.module))].sort((a,b)=>a.localeCompare(b));
    const actions=[...new Set(logs.map(log=>log.action))].sort((a,b)=>a.localeCompare(b));
    const formatActivityDate=value=>{const date=new Date(value);return Number.isNaN(date.getTime())?"—":date.toLocaleString("en-PH",{year:"numeric",month:"short",day:"2-digit",hour:"numeric",minute:"2-digit"})};
    return `<section class="panel activity-log-panel"><div class="panel-heading"><div><h3>Activity Log</h3><p>Permanent history of important transactions and administrative changes.</p></div><span class="count-pill" id="activity-visible-count">${logs.length} entr${logs.length===1?"y":"ies"}</span></div><div class="notice-note activity-protection"><strong>Protected audit trail:</strong> Entries are created automatically. Staff cannot edit or delete them, and only the Super Admin can view this page.</div><div class="toolbar toolbar-wrap activity-toolbar"><label class="search">⌕<input id="activity-search" placeholder="Search user, transaction, or description…"></label><div><select id="activity-module-filter"><option value="">All modules</option>${modules.map(value=>`<option value="${escapeFormValue(value)}">${escapeFormValue(value)}</option>`).join("")}</select><select id="activity-action-filter"><option value="">All actions</option>${actions.map(value=>`<option value="${escapeFormValue(value)}">${escapeFormValue(value)}</option>`).join("")}</select></div></div><div class="table-wrap"><table class="data-table activity-table"><thead><tr><th>Date & time</th><th>User</th><th>Role</th><th>Module</th><th>Transaction</th><th>Action</th><th>Description</th></tr></thead><tbody id="activity-log-rows">${logs.map(log=>`<tr data-activity-module="${escapeFormValue(log.module)}" data-activity-action="${escapeFormValue(log.action)}"><td><time datetime="${escapeFormValue(log.action_at||"")}">${formatActivityDate(log.action_at)}</time></td><td><strong>${escapeFormValue(log.userName)}</strong>${log.user_email&&log.user_email!==log.userName?`<small>${escapeFormValue(log.user_email)}</small>`:""}</td><td><span class="class-tag">${escapeFormValue(log.role)}</span></td><td>${escapeFormValue(log.module)}</td><td><strong class="linkish">${escapeFormValue(log.reference_number||"—")}</strong></td><td><span class="activity-action activity-${String(log.action).toLowerCase().replace(/[^a-z]+/g,"-")}">${escapeFormValue(log.action)}</span></td><td>${escapeFormValue(log.description)}</td></tr>`).join("")}<tr id="activity-no-results" ${logs.length?"hidden":""}><td colspan="7"><div class="empty-state compact"><h3>No activity found</h3><p>New transaction activity will appear here automatically.</p></div></td></tr></tbody></table></div></section>`;
  }
  if(adminTab==="System Settings"){
    const settings=readTenantSettings();
    const colors=Array.isArray(settings.colors)&&settings.colors.length>=2?settings.colors.slice(0,3):["#0F2942","#059669"];
    return `<form id="system-settings-form" class="system-settings-home"><section class="panel agency-settings-card"><div class="panel-heading"><div><h3>Agency Information</h3><p>The official identity used on the dashboard and generated forms.</p></div></div><div class="agency-settings-body"><div class="agency-brand-preview"><div class="agency-logo-preview" id="agency-logo-preview">${settings.logoPreview?`<img src="${escapeFormValue(settings.logoPreview)}" alt="Agency logo preview">`:`<b>${escapeFormValue((settings.agencyName||"A").slice(0,1))}</b>`}</div><p><strong>${escapeFormValue(settings.agencyName)}</strong><small>Agency name is permanent after setup.</small></p></div><div class="form-grid"><label>Agency Name<input name="agencyName" value="${escapeFormValue(settings.agencyName)}" readonly><small class="field-hint">Permanent agency identifier</small></label><label>Agency Address<textarea name="agencyAddress" placeholder="Complete agency address">${escapeFormValue(settings.agencyAddress||"")}</textarea></label><label>Agency Logo<input id="agency-logo-input" type="file" accept="image/png,image/jpeg"><small class="field-hint">Displayed at the top-left and on the dashboard.</small></label><label>Agency Header<input id="agency-header-input" type="file" accept="image/png,image/jpeg"><small class="field-hint">Used as the header of official forms.</small></label></div><div class="agency-header-preview" id="agency-header-preview">${settings.headerPreview?`<img src="${escapeFormValue(settings.headerPreview)}" alt="Agency header preview">`:`<span>No agency header uploaded</span>`}</div></div></section><section class="panel palette-settings-card"><div class="panel-heading"><div><h3>System Color Palette</h3><p>Choose at least two and at most three colors. Sinop automatically protects text contrast.</p></div><span id="palette-count">${colors.length} / 3</span></div><div class="palette-settings-body"><div id="tenant-color-pickers">${colors.map((color,index)=>`<label><span>Color ${index+1}</span><input type="color" data-tenant-color value="${escapeFormValue(color)}"><input class="color-code" data-tenant-color-code value="${escapeFormValue(color)}" maxlength="7" aria-label="Color ${index+1} hex code"></label>`).join("")}</div><div class="palette-actions"><button class="secondary-button" id="add-tenant-color" type="button" ${colors.length>=3?"disabled":""}>＋ Add third color</button><button class="secondary-button" id="remove-tenant-color" type="button" ${colors.length<=2?"disabled":""}>Remove third color</button></div><div class="palette-live-preview"><span>Navigation</span><strong>Readable dashboard preview</strong><button type="button">Sample action</button></div></div></section><section class="panel formula-settings-card"><div class="panel-heading"><div><h3>Inventory Costing Formula</h3><p>Used for expendable issues, Stock Cards, and RPCI.</p></div></div><div class="formula-settings-body"><label>Current Formula<select name="formula"><option ${settings.formula==="FIFO"?"selected":""}>FIFO</option><option ${settings.formula==="Running Average"?"selected":""}>Running Average</option></select></label><div class="formula-change-warning"><b>⚠ Historical transaction warning</b><p>Changing the formula applies only to new transactions. Previously completed transactions cannot be undone or recalculated unless the affected records are recreated.</p></div></div></section><div class="system-settings-actions"><p id="system-settings-message" aria-live="polite"></p><button class="primary-button" type="submit">Save System Settings</button></div></form>`;
  }
  const compactTables={
    Suppliers:{headers:["Name","Address","Organization Type","TIN No.","Tax Type"],rows:masters.Suppliers.map(row=>row.slice(0,5))},
    Items:{headers:["General Name","Description","Stock Number"],rows:masters.ItemDetails},
    Employees:{headers:["Employee Name","Position"],rows:masters.Employees.map(row=>[row[1],row[2]])},
    Plantilla:{headers:["Position","Status"],rows:masters.Plantilla},
    Departments:{headers:["Department"],rows:masters.Departments},
    UOM:{headers:["Name","Abbreviation"],rows:masters.UOM},
    "Procurement Modes":{headers:["Mode of Procurement","Status"],rows:masters.ProcurementModes}
  };
  if(compactTables[adminTab]){
    const table=compactTables[adminTab];
    const classificationFilter=adminTab==="Items"?`<select id="item-classification-filter"><option>All classifications</option><option>Expendable</option><option>Semi-Expendable</option><option>Capital Outlay</option></select>`:"";
    const inlineCreate=adminTab==="Plantilla"?`<form class="quick-master-create" id="quick-plantilla-form"><label>Plantilla Position<input name="name" placeholder="Enter position title" required></label><button class="primary-button">＋ Add Plantilla</button></form>`:adminTab==="Employees"?`<form class="quick-master-create employee-quick-create" id="quick-employee-form"><label>Employee Full Name<input name="name" placeholder="Enter complete name" required></label><label>Current Plantilla<select name="position" required><option value="">Select position</option>${masters.Plantilla.filter(row=>row[1]!=="Inactive").map(row=>`<option>${escapeFormValue(row[0])}</option>`).join("")}</select></label><button class="primary-button" ${masters.Plantilla.length?"":"disabled"}>＋ Add Employee</button></form>`:adminTab==="Departments"?`<form class="quick-master-create" id="quick-department-form"><label>Department Name<input name="name" placeholder="Enter department name" required></label><button class="primary-button">＋ Create Department</button></form>`:"";
    return `${inlineCreate}<section class="panel"><div class="toolbar toolbar-wrap"><label class="search">⌕<input id="master-search" placeholder="Search ${adminTab.toLowerCase()}…"></label><div>${classificationFilter}<button class="secondary-button" data-export="master">⇩ CSV</button></div></div><div id="master-table"><div class="table-wrap"><table class="data-table"><thead><tr>${table.headers.map(h=>`<th>${h}</th>`).join("")}<th>Action</th></tr></thead><tbody>${table.rows.map((row,rowIndex)=>`<tr data-classification="${adminTab==="Items"?(masters.Items[rowIndex]?.[6]||""):""}">${row.map((cell,i)=>`<td>${i===0?`<strong class="linkish">${cell}</strong>`:(cell||"—")}</td>`).join("")}<td><div class="row-actions">${adminTab==="Departments"?"":`<button data-edit-master="${rowIndex}">Edit</button>`}</div></td></tr>`).join("")}</tbody></table></div><div class="pagination"><span id="master-visible-count">${table.rows.length} ${adminTab.toLowerCase()}</span></div></div></section>`;
  }
  const headers={
    Items:["Item code","Item name","Category","Unit","Default UACS","Reorder level","Classification"],
    Categories:["Category","Classification rule","Default","Threshold-based","Status"],
    UACS:["UACS Object Code","Account title","Classification","PPE Sub-Major","GL Account","Status"]
  }[adminTab];
  const rows=masters[adminTab]||[];
  return `<section class="panel"><div class="toolbar toolbar-wrap"><label class="search">⌕<input id="master-search" placeholder="Search ${adminTab.toLowerCase()}…"></label><div><select><option>Active records</option><option>All records</option><option>Inactive</option></select><button class="secondary-button" data-export="master">⇩ CSV</button></div></div><div id="master-table"><div class="table-wrap"><table class="data-table"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}<th>Actions</th></tr></thead><tbody>${rows.map((r,rowIndex)=>`<tr>${r.map((c,i)=>`<td>${i===0?`<strong class="linkish">${c}</strong>`:i===r.length-1?badge(c):c}</td>`).join("")}<td><div class="row-actions"><button data-edit-master="${rowIndex}">Edit</button><button>•••</button></div></td></tr>`).join("")}</tbody></table></div><div class="pagination"><span id="master-visible-count">${rows.length} active ${adminTab.toLowerCase()}</span><div><button disabled>‹</button><button class="active">1</button><button>›</button></div></div></div></section>`;
}

function enhancedReports(){
  const tabs=["Overview",...physicalReportOptions];
  if(!tabs.includes(reportTab))reportTab="Overview";
  return `<section class="page-heading"><div><h2>Reports</h2><p>Prepare the consolidated physical-count and property registry reports.</p></div><div class="report-period"><label>Reporting month <input type="month"></label></div></section><div class="module-tabs report-tabs">${tabs.map(t=>`<button class="${reportTab===t?"active":""}" data-report-tab="${t}">${t}</button>`).join("")}</div>${reportContent(reportTab)}`;
}
function reportContent(selectedTab=reportTab){
  if(selectedTab==="Overview"){
    const cards=[["RCPI","Appendix 66 — Report on the Physical Count of Inventories","Remaining expendable balances grouped by inventory category with official signatories.","Appendix 66 (RCPI)"],["RPCPPE","Appendix 73 — Report on the Physical Count of PPE","Consolidated capital-outlay property records grouped by PPE category.","Appendix 73 (RPCPPE)"],["REG","Annex A.4 — Semi-Expendable Property Registry","Issued semi-expendable property units grouped by account category.","Annex A.4"]];
    return `<section class="report-grid reports-overview-grid">${cards.map(r=>`<article class="report-card"><span>${r[0]}</span><div><h3>${r[1]}</h3><p>${r[2]}</p><small>Uses saved and accepted records only</small></div><button data-open-report="${r[3]}">Open report →</button></article>`).join("")}</section><section class="panel"><div class="panel-heading"><div><h3>Reporting readiness</h3><p>Source records available for the three consolidated reports</p></div></div><div class="readiness"><div><b>${buildInventoryBalanceRows().length}</b><span>Expendable balances</span></div><div><b>${propertyUnits.filter(unit=>unit.classification==="Capital Outlay").length}</b><span>Capital Outlay units</span></div><div><b>${propertyUnits.filter(unit=>unit.classification==="Semi-Expendable").length}</b><span>Semi-Expendable units</span></div><div><b>${iars.filter(r=>r[6]==="Completed").length}</b><span>Completed IARs</span></div></div></section>`;
  }
  if(selectedTab==="RSMI")return `<section class="panel"><div class="panel-heading"><div><h3>Generated RSMI reports</h3><p>View each finalized report and its included RIS records.</p></div><div><button class="secondary-button" data-export="rsmi">⇩ CSV</button> <button class="primary-button" data-go="RSMI Generation">Generate RSMI</button></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>RSMI number</th><th>Reporting period</th><th>Date prepared</th><th>Included RIS</th><th>Total issued cost</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rsmiRecords.map(r=>`<tr><td><strong class="linkish">${r.number}</strong></td><td>${r.period}</td><td>${r.prepared}</td><td>${r.ris.join(", ")}</td><td><strong>${peso.format(r.value)}</strong></td><td>${badge(r.status)}</td><td><div class="row-actions"><button>View RIS</button><button data-print>Print</button></div></td></tr>`).join("")}</tbody></table></div></section>`;
  if(selectedTab==="Appendix 57 (SLC)")return suppliesLedgerReport();
  if(selectedTab==="Appendix 58 (SC)")return stockCardReport();
  if(selectedTab==="Appendix 59 (ICS)")return inventoryCustodianSlipReport();
  if(selectedTab==="Appendix 65 (WMR)")return wasteMaterialsReport();
  if(selectedTab==="Appendix 66 (RCPI)")return rcpiReport();
  if(selectedTab==="Appendix 69 (PC)")return propertyCardReport();
  if(selectedTab==="Appendix 70 (PPELC)")return ppeLedgerReport();
  if(selectedTab==="Appendix 71 (PAR)")return propertyAcknowledgementReceiptReport();
  if(selectedTab==="Appendix 73 (RPCPPE)")return rpcppeReport();
  if(selectedTab==="Appendix 74 (IIRUP)")return unserviceablePropertyReport();
  if(selectedTab==="Appendix 75 (RLSDDP)")return lostStolenDamagedPropertyReport();
  if(selectedTab==="Appendix 76 (PTR)")return propertyTransferReport();
  if(selectedTab==="Annex A.4")return semiExpendableRegistryReport();
  if(selectedTab==="RIS")return reportShell("RIS Report","Filter by date range, number, item, office, employee, or status.",risReportTable(),"",selectedTab);
  if(selectedTab==="Inventory Balance")return reportShell("Inventory Balance Report","Expendable items only, sorted A–Z. In quantities come from completed IAR items; Out quantities come from completed RIS item lines.",inventoryReportTable(),`<div class="inventory-item-search-row"><label class="search">⌕<input id="inventory-balance-search" placeholder="Search existing item name or stock number…" autocomplete="off"></label><span id="inventory-balance-search-count">Existing expendable items only</span></div>`,selectedTab);
  const classification=selectedTab==="Semi-Expendable"?"Semi-Expendable":"Capital Outlay";
  return reportShell(`${classification} Property Report`,"Filter individual units by acquisition, source document, employee, office, location, condition, or status.",propertyTable(propertyUnits.filter(p=>p.classification===classification)),"",selectedTab);
}
function reportShell(title,description,content,additionalFilters="",filterKey=reportTab){
  const filter=reportDateFilters[filterKey]||{from:"",to:"",search:"",status:"All statuses"};
  reportDateFilters[filterKey]=filter;
  return `<section class="panel"><div class="panel-heading"><div><h3>${title}</h3><p>${description}</p></div><div><button class="secondary-button" data-export="report">⇩ CSV</button> <button class="secondary-button" data-print>Print</button></div></div><div class="report-filters"><label>Date from<input id="report-date-from" data-report-filter="from" type="date" value="${escapeFormValue(filter.from)}" aria-label="Date from"></label><label>Date to<input id="report-date-to" data-report-filter="to" type="date" value="${escapeFormValue(filter.to)}" aria-label="Date to"></label><label>Search<input data-report-filter="search" value="${escapeFormValue(filter.search)}" placeholder="Document, item, office, employee…"></label><label>Status<select data-report-filter="status">${["All statuses","Available","Issued","Completed"].map(value=>`<option ${value===filter.status?"selected":""}>${value}</option>`).join("")}</select></label><button class="primary-button" id="apply-report-filters" type="button">Apply filters</button></div><p class="report-date-feedback" id="report-date-feedback" aria-live="polite"></p>${additionalFilters}${content}</section>`;
}
function risReportTable(){return `<div class="table-wrap"><table class="data-table"><thead><tr><th>RIS number</th><th>Date</th><th>Office</th><th>Requested by</th><th>Purpose</th><th>Items</th><th>Issued value</th><th>Status</th></tr></thead><tbody>${risRecords.map(r=>`<tr><td><strong class="linkish">${r.number}</strong></td><td>${r.date}</td><td>${r.office}</td><td>${r.requestedBy}</td><td>${r.purpose}</td><td>${r.items}</td><td>${peso.format(r.value)}</td><td>${badge(r.status)}</td></tr>`).join("")}</tbody></table></div>`}
function inventoryReportTable(){
  const movements=new Map();
  const itemMasterFor=item=>masters.Items.find(record=>record[1]===item.description)||masters.Items.find(record=>record[0]===item.stockNumber);
  const isExpendable=item=>(item.classification||itemMasterFor(item)?.[6]||"")==="Expendable";
  const getMovement=item=>{
    const description=item.description||"Unnamed item";
    const key=String(item.itemId||item.stockNumber||description);
    const itemMaster=itemMasterFor(item);
    if(!movements.has(key))movements.set(key,{key,description,stockNumber:item.stockNumber||itemMaster?.[0]||"",uom:item.uom||itemMaster?.[3]||"—",uacs:itemMaster?.[4]||"Not assigned",inQty:0,outQty:0,iarSources:new Set(),risSources:new Set()});
    return movements.get(key);
  };
  iars.filter(iar=>iar[6]==="Completed").forEach(iar=>(iar[7]||[]).forEach(item=>{
    if(!isExpendable(item))return;
    const row=getMovement(item);
    row.inQty+=Number(item.qty)||0;
    row.iarSources.add(iar[0]);
  }));
  risRecords.filter(ris=>ris.status==="Completed").forEach(ris=>(ris.lines||[]).forEach(item=>{
    if(!isExpendable(item))return;
    const row=getMovement(item);
    row.outQty+=Number(item.qty)||0;
    row.risSources.add(ris.number);
  }));
  const rows=[...movements.values()].sort((a,b)=>a.description.localeCompare(b.description,undefined,{sensitivity:"base",numeric:true}));
  if(!rows.length)return `<div class="empty-state"><span>IB</span><h3>No expendable inventory movements yet</h3><p>Complete an IAR for expendable stock in or complete an RIS for stock out.</p></div>`;
  const eligibleKeys=new Set(buildAppendix58Cards().map(card=>card.key));
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Item</th><th>UACS</th><th>Unit</th><th>In</th><th>Out</th><th>Completed RIS source</th><th>Stock Card</th></tr></thead><tbody id="inventory-balance-rows">${rows.map(row=>`<tr data-inventory-item="${escapeFormValue(row.description)}" data-inventory-stock="${escapeFormValue(row.stockNumber)}"><td><strong>${row.description}</strong></td><td><span class="class-tag">${row.uacs}</span></td><td>${row.uom}</td><td><strong class="movement-in">${row.inQty}</strong></td><td><strong class="movement-out">${row.outQty}</strong></td><td>${[...row.risSources].join(", ")||"—"}</td><td>${eligibleKeys.has(row.key)?`<button class="table-link-button" data-stock-card="${row.key}">View Stock Card</button>`:`<span class="muted">Not applicable</span>`}</td></tr>`).join("")}<tr id="inventory-balance-no-results" hidden><td colspan="7"><div class="empty-state compact"><h3>No existing item found</h3><p>Search using the item name or its stock number.</p></div></td></tr></tbody></table></div>`;
}

function buildAppendix58Cards(){
  const cards=new Map();
  iars.filter(iar=>iar[6]==="Completed").forEach(iar=>(iar[7]||[]).forEach(line=>{
    if(line.classification!=="Expendable"||Number(line.qty)<=0)return;
    const key=String(line.itemId||line.stockNumber||line.description);
    if(!cards.has(key))cards.set(key,{
      key,
      itemId:line.itemId||"",
      item:line.generalName||line.description||"",
      description:line.itemDescription||"",
      stockNumber:line.stockNumber||"",
      reorderPoint:line.reorderLevel??0,
      uom:line.uom||"",
      transactions:[]
    });
    cards.get(key).transactions.push({
      isoDate:iar.isoDate||"",
      date:iar[3]||"",
      reference:`IAR: ${iar[0]||""}`.trim(),
      receipt:Number(line.qty)||0,
      issue:0,
      unitCost:Number(line.unitCost)||0,
      totalCost:Number(line.total??(Number(line.qty||0)*Number(line.unitCost||0)))||0,
      office:"",
      order:0
    });
  }));
  risRecords.filter(ris=>ris.status==="Completed").forEach(ris=>(ris.lines||[]).forEach(line=>{
    const key=String(line.itemId||line.stockNumber||line.description);
    const card=cards.get(key);
    if(!card||line.classification!=="Expendable")return;
    card.transactions.push({
      isoDate:ris.isoDate||"",
      date:ris.date||"",
      reference:`RIS: ${ris.number||""}`.trim(),
      receipt:0,
      issue:Number(line.qty)||0,
      unitCost:Number(line.unitCost)||0,
      totalCost:Number(line.totalCost??(Number(line.qty||0)*Number(line.unitCost||0)))||0,
      office:ris.office||"",
      order:1
    });
  }));
  return [...cards.values()].map(card=>{
    let balance=0;
    let balanceValue=0;
    card.transactions.sort((a,b)=>String(a.isoDate).localeCompare(String(b.isoDate))||a.order-b.order);
    card.transactions=card.transactions.map(transaction=>{
      balance+=transaction.receipt-transaction.issue;
      balanceValue+=transaction.receipt?transaction.totalCost:-transaction.totalCost;
      if(Math.abs(balanceValue)<0.005)balanceValue=0;
      return {...transaction,balance,balanceValue,balanceUnitCost:balance?balanceValue/balance:0};
    });
    return card;
  }).sort((a,b)=>a.item.localeCompare(b.item)||a.description.localeCompare(b.description));
}

function stockCardReport(){
  const escape=value=>String(value??"").replaceAll("&","&amp;").replaceAll('"',"&quot;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  const cards=buildAppendix58Cards();
  if(!cards.length)return `<section class="panel"><div class="empty-state"><span>SC</span><h3>No eligible Appendix 58 stock cards yet</h3><p>Only expendable items from completed or approved IARs are recorded here.</p></div></section>`;
  if(!cards.some(card=>card.key===stockCardItemKey))stockCardItemKey=cards[0].key;
  const card=cards.find(item=>item.key===stockCardItemKey)||cards[0];
  const employeeOptions=[...masters.Employees].sort((a,b)=>a[1].localeCompare(b[1])).map(employee=>`<option value="${escape(employee[1])}" data-position="${escape(employee[2])}">${escape(employee[1])}</option>`).join("");
  const rows=card.transactions.map(transaction=>`<tr><td>${escape(transaction.date)}</td><td>${escape(transaction.reference)}</td><td class="number-cell">${transaction.receipt||""}</td><td class="number-cell">${transaction.issue||""}</td><td>${escape(transaction.office)}</td><td class="number-cell">${transaction.balance}</td><td></td></tr>`).join("");
  const blankRows=Array.from({length:Math.max(0,18-card.transactions.length)},()=>`<tr class="blank-stock-row"><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`).join("");
  return `<section class="page-heading stock-card-page-heading no-print"><div><h2>Appendix 58 — Stock Card</h2><p>One stock card per expendable item received through a completed IAR.</p></div><button class="primary-button" data-print>Print stock card</button></section>
  <section class="panel stock-card-selector no-print"><label>View stock card<select id="stock-card-item-select">${cards.map(item=>`<option value="${escape(item.key)}" ${item.key===card.key?"selected":""}>${escape(item.item)}${item.description?` — ${escape(item.description)}`:""}</option>`).join("")}</select></label><div><strong>${cards.length}</strong><span>eligible expendable item${cards.length===1?"":"s"}</span></div></section>
  <article class="stock-card-print-area">
    <div class="stock-card-appendix">Appendix 58</div>
    <img class="stock-card-header-image" src="/agency-header-placeholder.png" alt="Your Agency official header">
    <h1>STOCK CARD</h1>
    <div class="stock-card-meta"><div><span>Entity Name:</span><strong>${escape(window.stockCardEntityName||"Your Agency")}</strong></div><div><span>Fund Cluster:</span><strong>Regular Fund 01</strong></div><div><span>Item:</span><strong>${escape(card.item)}</strong></div><div><span>Stock No.:</span><strong>${escape(card.stockNumber)}</strong></div><div><span>Description:</span><strong>${escape(card.description)}</strong></div><div><span>Re-order Point:</span><strong>${escape(card.reorderPoint)}</strong></div><div class="wide"><span>Unit of Measurement:</span><strong>${escape(card.uom)}</strong></div></div>
    <table class="stock-card-table"><thead><tr><th rowspan="2">Date</th><th rowspan="2">Reference</th><th>Receipt</th><th colspan="2">Issue</th><th>Balance</th><th rowspan="2">No. of Days<br>to Consume</th></tr><tr><th>Qty.</th><th>Qty.</th><th>Office</th><th>Qty.</th></tr></thead><tbody>${rows}${blankRows}</tbody></table>
    <div class="stock-card-signature"><span>Prepared by:</span><strong id="sc-prepared-name">____________________________</strong><small>Signature over printed name</small><b id="sc-prepared-position">Position</b></div>
  </article>
  <section class="panel stock-card-signatory-control no-print"><div><h3>Prepared by</h3><p>Select an employee from Admin Options. The corresponding position appears below.</p></div><label>Employee<select id="sc-employee-select"><option value="">Select employee</option>${employeeOptions}</select><small id="sc-selected-position">Position will appear here</small></label></section>`;
}

function suppliesLedgerReport(){
  const escape=value=>String(value??"").replaceAll("&","&amp;").replaceAll('"',"&quot;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  const money=value=>Number(value||0)?Number(value).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2}):"";
  const cards=buildAppendix58Cards();
  if(!cards.length)return `<section class="panel"><div class="empty-state"><span>SLC</span><h3>No eligible Appendix 57 supplies ledger cards yet</h3><p>Only expendable items from completed IARs are recorded here.</p></div></section>`;
  if(!cards.some(card=>card.key===suppliesLedgerItemKey))suppliesLedgerItemKey=cards[0].key;
  const card=cards.find(item=>item.key===suppliesLedgerItemKey)||cards[0];
  const employeeOptions=[...masters.Employees].sort((a,b)=>a[1].localeCompare(b[1])).map(employee=>`<option value="${escape(employee[1])}" data-position="${escape(employee[2])}">${escape(employee[1])}</option>`).join("");
  const rows=card.transactions.map(transaction=>`<tr><td>${escape(transaction.date)}</td><td>${escape(transaction.reference)}</td><td class="number-cell">${transaction.receipt||""}</td><td class="number-cell">${transaction.receipt?money(transaction.unitCost):""}</td><td class="number-cell">${transaction.receipt?money(transaction.totalCost):""}</td><td class="number-cell">${transaction.issue||""}</td><td class="number-cell">${transaction.issue?money(transaction.unitCost):""}</td><td class="number-cell">${transaction.issue?money(transaction.totalCost):""}</td><td class="number-cell">${transaction.balance}</td><td class="number-cell">${money(transaction.balanceUnitCost)}</td><td class="number-cell">${money(transaction.balanceValue)}</td><td></td></tr>`).join("");
  const blankRows=Array.from({length:Math.max(0,16-card.transactions.length)},()=>`<tr class="blank-stock-row"><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`).join("");
  return `<section class="page-heading stock-card-page-heading no-print"><div><h2>Appendix 57 — Supplies Ledger Card</h2><p>One accounting ledger card per expendable inventory item.</p></div><button class="primary-button" data-print>Print supplies ledger</button></section>
  <section class="panel stock-card-selector no-print"><label>View supplies ledger<select id="slc-item-select">${cards.map(item=>`<option value="${escape(item.key)}" ${item.key===card.key?"selected":""}>${escape(item.item)}${item.description?` — ${escape(item.description)}`:""}</option>`).join("")}</select></label><div><strong>${cards.length}</strong><span>eligible expendable item${cards.length===1?"":"s"}</span></div></section>
  <article class="stock-card-print-area slc-print-area">
    <div class="stock-card-appendix">Appendix 57</div>
    <img class="stock-card-header-image" src="/agency-header-placeholder.png" alt="Your Agency official header">
    <h1>SUPPLIES LEDGER CARD</h1>
    <div class="stock-card-meta"><div><span>Entity Name:</span><strong>${escape(window.stockCardEntityName||"Your Agency")}</strong></div><div><span>Fund Cluster:</span><strong>Regular Fund 01</strong></div><div><span>Item:</span><strong>${escape(card.item)}</strong></div><div><span>Item Code:</span><strong>${escape(card.stockNumber)}</strong></div><div><span>Description:</span><strong>${escape(card.description)}</strong></div><div><span>Re-order Point:</span><strong>${escape(card.reorderPoint)}</strong></div><div class="wide"><span>Unit of Measurement:</span><strong>${escape(card.uom)}</strong></div></div>
    <table class="stock-card-table slc-table"><thead><tr><th rowspan="2">Date</th><th rowspan="2">Reference</th><th colspan="3">Receipt</th><th colspan="3">Issue</th><th colspan="3">Balance</th><th rowspan="2">No. of Days<br>to Consume</th></tr><tr><th>Qty.</th><th>Unit Cost</th><th>Total Cost</th><th>Qty.</th><th>Unit Cost</th><th>Total Cost</th><th>Qty.</th><th>Unit Cost</th><th>Total Cost</th></tr></thead><tbody>${rows}${blankRows}</tbody></table>
    <div class="stock-card-signature"><span>Prepared by:</span><strong id="slc-prepared-name">____________________________</strong><small>Signature over printed name</small><b id="slc-prepared-position">Position</b></div>
  </article>
  <section class="panel stock-card-signatory-control no-print"><div><h3>Prepared by</h3><p>Select an employee from Admin Options. The corresponding position appears below.</p></div><label>Employee<select id="slc-employee-select"><option value="">Select employee</option>${employeeOptions}</select><small id="slc-selected-position">Position will appear here</small></label></section>`;
}

function escapeFormValue(value){return String(value??"").replaceAll("&","&amp;").replaceAll('"',"&quot;").replaceAll("<","&lt;").replaceAll(">","&gt;")}
function capitalPropertyUnits(){return propertyUnits.map((unit,index)=>({unit,index,key:String(unit.dbId||index)})).filter(entry=>entry.unit.classification==="Capital Outlay").sort((a,b)=>String(a.unit.item).localeCompare(String(b.unit.item))||String(a.unit.number||"").localeCompare(String(b.unit.number||"")))}
function acceptedAccountablePropertyUnits(){return propertyUnits.map((unit,index)=>({unit,index,key:String(unit.dbId||index)})).filter(entry=>["Semi-Expendable","Capital Outlay"].includes(entry.unit.classification)).sort((a,b)=>String(a.unit.classification).localeCompare(String(b.unit.classification))||String(a.unit.item).localeCompare(String(b.unit.item))||String(a.unit.inventoryNumber||a.unit.number||"").localeCompare(String(b.unit.inventoryNumber||b.unit.number||"")))}
function propertyUnitLabel(entry){const unit=entry.unit;return `${unit.item}${unit.number?` — ${unit.number}`:" — Property number pending"}`}
function employeePosition(name){return masters.Employees.find(employee=>employee[1]===name)?.[2]||""}
function propertyEmployeeOptions(selected=""){return [...masters.Employees].sort((a,b)=>a[1].localeCompare(b[1])).map(employee=>`<option value="${escapeFormValue(employee[1])}" ${employee[1]===selected?"selected":""}>${escapeFormValue(employee[1])}</option>`).join("")}
function propertySelector(entries,selected,id){return `<select id="${id}">${entries.map(entry=>`<option value="${escapeFormValue(entry.key)}" ${entry.key===selected?"selected":""}>${escapeFormValue(propertyUnitLabel(entry))}</option>`).join("")}</select>`}
function propertyEmptyState(code,title,detail="Complete an IAR containing a semi-expendable or capital-outlay item to create the property record used by this form."){return `<section class="panel"><div class="empty-state"><span>${code}</span><h3>No eligible ${title} records yet</h3><p>${detail}</p></div></section>`}

function semiPropertyUnits(){return propertyUnits.map((unit,index)=>({unit,index,key:String(unit.dbId||index)})).filter(entry=>entry.unit.classification==="Semi-Expendable").sort((a,b)=>String(a.unit.item).localeCompare(String(b.unit.item))||String(a.unit.inventoryNumber||a.unit.number||"").localeCompare(String(b.unit.inventoryNumber||b.unit.number||"")))}
function inventoryCustodianSlipReport(){
  const entries=semiPropertyUnits();
  if(!entries.length)return `<section class="panel"><div class="empty-state"><span>ICS</span><h3>No eligible Appendix 59 records yet</h3><p>Complete an IAR containing a semi-expendable item to create its property unit.</p></div></section>`;
  if(!entries.some(entry=>entry.key===icsPropertyKey))icsPropertyKey=entries.find(entry=>entry.unit.icsNumber)?.key||entries[0].key;
  const unit=entries.find(entry=>entry.key===icsPropertyKey).unit;
  const amount=Number(unit.cost||0).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2});
  const signature=(label,name,position)=>`<div><strong>${label}</strong><span class="signature-space"></span><b>${escapeFormValue(name||"____________________________")}</b><small>Signature over printed name</small><span>${escapeFormValue(position||employeePosition(name)||"Position/Office")}</span><small>Position/Office</small></div>`;
  const details=[
    ["Brand",unit.brand||"N/A"],["Model",unit.model||"N/A"],["Serial No.",unit.serial||"N/A"],
    ["PPE No.",unit.number||"Pending"],["Date Acquired",unit.date||""],["Supplier",unit.supplier||""],
  ].map(([label,value])=>`<li><b>${label}:</b> ${escapeFormValue(value)}</li>`).join("");
  return `<section class="page-heading no-print"><div><h2>Appendix 59 — Inventory Custodian Slip</h2><p>Official accountability form for a semi-expendable property unit.</p></div><button class="primary-button" data-print ${unit.icsNumber?"":"disabled"}>Print ICS</button></section>
  <section class="panel stock-card-selector no-print"><label>View semi-expendable unit${propertySelector(entries,icsPropertyKey,"ics-property-select")}</label><div><strong>${entries.length}</strong><span>eligible record${entries.length===1?"":"s"}</span></div></section>
  ${unit.icsNumber?"":`<section class="info-banner no-print"><span>i</span><div><strong>This unit has not been issued yet</strong><p>Open Property Records and choose Issue / edit ICS. The ICS and Inventory numbers are assigned when the record is saved.</p></div><button data-edit-property="${entries.find(entry=>entry.key===icsPropertyKey).index}">Issue item →</button></section>`}
  <article class="property-official-form ics-form">
    <div class="property-form-appendix">Appendix 59</div><img class="property-form-header ics-header" src="/agency-header-placeholder.png" alt="Your Agency official header"><h1>INVENTORY CUSTODIAN SLIP</h1>
    <div class="ics-meta"><p class="ics-entity">Entity Name: <strong>${escapeFormValue(window.stockCardEntityName||"Your Agency")}</strong></p><p>Fund Cluster: <strong>${escapeFormValue(unit.fundSource||"Regular Fund 01")}</strong></p><p class="ics-number"><span>ICS No.:</span><strong>${escapeFormValue(unit.icsNumber||"Assigned upon issue")}</strong></p></div>
    <table class="property-form-table ics-table"><colgroup><col style="width:9.3%"><col style="width:7.5%"><col style="width:11.2%"><col style="width:11.2%"><col style="width:38.3%"><col style="width:12.3%"><col style="width:10.2%"></colgroup><thead><tr><th rowspan="2">Quantity</th><th rowspan="2">Unit</th><th colspan="2">Amount</th><th rowspan="2">Description</th><th rowspan="2">Inventory Item<br>No.</th><th rowspan="2">Estimated<br>Useful Life</th></tr><tr><th>Unit Cost</th><th>Total Cost</th></tr></thead><tbody><tr><td>1</td><td>${escapeFormValue(unit.uom||"Unit")}</td><td class="number-cell">₱${amount}</td><td class="number-cell">₱${amount}</td><td><strong>${escapeFormValue(unit.item)}</strong><ul class="ics-specs">${details}</ul><div class="ics-other-info"><b>Other Info</b><p>${escapeFormValue(unit.otherInfo||"")}</p></div></td><td>${escapeFormValue(unit.inventoryNumber||"Pending issue")}</td><td>${escapeFormValue(`${unit.usefulLife||5} YRS`)}</td></tr></tbody></table>
    <div class="ics-signatures">${signature("Issued by:",unit.issuedBy,unit.issuedByPosition)}${signature("Received by:",unit.employee,unit.position)}</div>
  </article>`;
}

function propertyCardReport(){
  const entries=acceptedAccountablePropertyUnits();
  if(!entries.length)return propertyEmptyState("PC","Appendix 69 Property Card");
  if(!entries.some(entry=>entry.key===propertyCardKey))propertyCardKey=entries[0].key;
  const unit=entries.find(entry=>entry.key===propertyCardKey).unit;
  const amount=Number(unit.cost||0).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2});
  const transaction=`<tr><td>${escapeFormValue(unit.date)}</td><td>${escapeFormValue(unit.parNumber||unit.iar||unit.po)}</td><td class="number-cell">1</td><td></td><td>${escapeFormValue(unit.employee||unit.office)}</td><td class="number-cell">1</td><td class="number-cell">${amount}</td><td>${escapeFormValue(unit.status||"Available")}</td></tr>`;
  const blanks=Array.from({length:17},()=>`<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`).join("");
  return `<section class="page-heading no-print"><div><h2>Appendix 69 — Property Card</h2><p>Property Card for every accepted semi-expendable and capital-outlay unit.</p></div><button class="primary-button" data-print>Print property card</button></section>
  <section class="panel stock-card-selector no-print"><label>View property card${propertySelector(entries,propertyCardKey,"property-card-select")}</label><div><strong>${entries.length}</strong><span>accepted property record${entries.length===1?"":"s"}</span></div></section>
  <article class="property-official-form property-card-form">
    <div class="property-form-appendix">Appendix 69</div><img class="property-form-header" src="/agency-header-placeholder.png" alt="Your Agency official header"><h1>PROPERTY CARD</h1>
    <div class="property-form-meta two-column"><p>Entity Name: <strong>${escapeFormValue(window.stockCardEntityName||"Your Agency")}</strong></p><p>Fund Cluster: <strong>${escapeFormValue(unit.fundSource||"Regular Fund 01")}</strong></p></div>
    <div class="property-form-meta property-card-details"><p>Property, Plant and Equipment: <strong>${escapeFormValue(unit.item)}</strong></p><p>Property Number: <strong>${escapeFormValue(unit.number||"____________________")}</strong></p><p class="wide">Description: <strong>${escapeFormValue(unit.description||[unit.brand,unit.model,unit.serial&&`Serial ${unit.serial}`].filter(Boolean).join(" · ")||unit.item)}</strong></p></div>
    <table class="property-form-table property-card-table"><colgroup><col><col><col><col><col><col><col><col></colgroup><thead><tr><th rowspan="2">Date</th><th rowspan="2">Reference/<br>PAR No.</th><th>Receipt</th><th colspan="2">Issue/Transfer/Disposal</th><th>Balance</th><th rowspan="2">Amount</th><th rowspan="2">Remarks</th></tr><tr><th>Qty.</th><th>Qty.</th><th>Office/Officer</th><th>Qty.</th></tr></thead><tbody>${transaction}${blanks}</tbody></table>
  </article>`;
}

function ppeLedgerReport(){
  const entries=acceptedAccountablePropertyUnits();
  if(!entries.length)return propertyEmptyState("PPELC","Appendix 70 PPE Ledger Card");
  if(!entries.some(entry=>entry.key===ppeLedgerKey))ppeLedgerKey=entries[0].key;
  const unit=entries.find(entry=>entry.key===ppeLedgerKey).unit;
  const cost=Number(unit.cost||0).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2});
  const reference=unit.iar?`IAR No.: ${unit.iar}`:unit.po?`PO No.: ${unit.po}`:"";
  const hasIcsIssue=unit.classification==="Semi-Expendable"&&Boolean(unit.icsNumber);
  const receiptRow=`<tr><td>${escapeFormValue(unit.date)}</td><td>${escapeFormValue(reference)}</td><td class="number-cell">1</td><td class="number-cell">${cost}</td><td class="number-cell">${cost}</td><td></td><td></td><td>${hasIcsIssue?"":escapeFormValue(unit.status&&unit.status!=="Available"?unit.status:"")}</td><td class="number-cell">${cost}</td><td></td><td></td></tr>`;
  const issueRow=hasIcsIssue?`<tr><td>${escapeFormValue(unit.issuedDate||"")}</td><td>${escapeFormValue(`ICS No.: ${unit.icsNumber}`)}</td><td></td><td></td><td></td><td></td><td></td><td>Issued</td><td></td><td></td><td></td></tr>`:"";
  const transactions=receiptRow+issueRow;
  const blanks=Array.from({length:18-(hasIcsIssue?1:0)},()=>`<tr>${Array.from({length:11},()=>"<td>&nbsp;</td>").join("")}</tr>`).join("");
  return `<section class="page-heading no-print"><div><h2>Appendix 70 — PPE Ledger Card</h2><p>Ledger Card for every accepted semi-expendable and capital-outlay unit.</p></div><button class="primary-button" data-print>Print PPE ledger card</button></section>
  <section class="panel stock-card-selector no-print"><label>View PPE ledger${propertySelector(entries,ppeLedgerKey,"ppe-ledger-select")}</label><div><strong>${entries.length}</strong><span>accepted property record${entries.length===1?"":"s"}</span></div></section>
  <article class="property-official-form ppelc-form">
    <div class="property-form-appendix">Appendix 70</div><img class="property-form-header" src="/agency-header-placeholder.png" alt="Your Agency official header"><h1>PROPERTY, PLANT AND EQUIPMENT LEDGER CARD</h1>
    <div class="property-form-meta two-column"><p>Entity Name: <strong>${escapeFormValue(window.stockCardEntityName||"Your Agency")}</strong></p><p>Fund Cluster: <strong>${escapeFormValue(unit.fundSource||"Regular Fund 01")}</strong></p></div>
    <div class="property-form-meta ppelc-details"><p>Property, Plant and Equipment: <strong>${escapeFormValue(unit.item)}</strong></p><p>Object Account Code: <strong>${escapeFormValue(unit.uacsCode||"____________________")}</strong></p><p>Description: <strong>${escapeFormValue(unit.description||[unit.brand,unit.model,unit.serial&&`Serial ${unit.serial}`].filter(Boolean).join(" · ")||unit.item)}</strong></p><p>Estimated Useful Life: <strong>____________________</strong><br>Rate of Depreciation: <strong>____________________</strong></p></div>
    <table class="property-form-table ppelc-table"><colgroup><col><col><col><col><col><col><col><col><col><col><col></colgroup><thead><tr><th rowspan="2">Date</th><th rowspan="2">Reference</th><th colspan="3">Receipt</th><th rowspan="2">Accumulated<br>Depreciation</th><th rowspan="2">Accumulated<br>Impairment Losses</th><th rowspan="2">Issues / Transfers /<br>Adjustments</th><th rowspan="2">Adjusted<br>Cost</th><th colspan="2">Repair History</th></tr><tr><th>Qty.</th><th>Unit<br>Cost</th><th>Total<br>Cost</th><th>Nature of<br>Repair</th><th>Amount</th></tr></thead><tbody>${transactions}${blanks}</tbody></table>
  </article>`;
}

function propertyAcknowledgementReceiptReport(){
  const entries=capitalPropertyUnits();
  if(!entries.length)return propertyEmptyState("PAR","Appendix 71 Property Acknowledgement Receipt","Complete an IAR containing a Capital Outlay item to create the PPE record used by this form.");
  if(!entries.some(entry=>entry.key===parPropertyKey))parPropertyKey=entries.find(entry=>entry.unit.parNumber)?.key||entries[0].key;
  const entry=entries.find(value=>value.key===parPropertyKey);
  const unit=entry.unit;
  const amount=Number(unit.cost||0).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2});
  const signature=(label,name,position)=>`<section><strong>${label}</strong><span class="par-signature-space"></span><b>${escapeFormValue(name||"____________________________")}</b><em>${escapeFormValue(position||employeePosition(name)||"Position/Office")}</em></section>`;
  const detail=(label,value)=>`<li><b>${label}:</b><span>${escapeFormValue(value||"N/A")}</span></li>`;
  return `<section class="page-heading no-print"><div><h2>Appendix 71 — Property Acknowledgement Receipt</h2><p>Official Capital Outlay PPE issuance form based on the selected property record.</p></div><button class="primary-button" data-print>Print PAR</button></section>
  <section class="panel stock-card-selector no-print"><label>View Capital Outlay PPE${propertySelector(entries,parPropertyKey,"par-property-select")}</label><div><strong>${entries.length}</strong><span>eligible record${entries.length===1?"":"s"}</span></div></section>
  ${unit.parNumber&&unit.employee?"":`<section class="info-banner no-print"><span>i</span><div><strong>This PPE issuance is incomplete</strong><p>Open Property Records → Capital Outlay → Edit property unit to enter the PAR No., Received From, and Received By.</p></div><button data-edit-property="${entry.index}">Complete issuance →</button></section>`}
  <article class="property-official-form par-form">
    <div class="property-form-appendix">Appendix 71</div><img class="property-form-header par-header" src="/agency-header-placeholder.png" alt="Your Agency official header"><h1>PROPERTY ACKNOWLEDGEMENT RECEIPT</h1>
    <div class="par-document-meta"><p><b>No.:</b><strong>${escapeFormValue(unit.parNumber||"____________________")}</strong></p><p><b>Fund:</b><strong>${escapeFormValue(unit.fundSource||"Regular Fund 01")}</strong></p></div>
    <table class="property-form-table par-table"><colgroup><col class="par-quantity"><col class="par-unit"><col class="par-description"><col class="par-property-number"></colgroup><thead><tr><th>QUANTITY</th><th>UNIT</th><th>DESCRIPTION</th><th>PROPERTY NO.:</th></tr></thead><tbody><tr><td>1</td><td>${escapeFormValue(unit.uom||"Unit")}</td><td><h2>${escapeFormValue(unit.item||unit.description||"")}</h2><ul>${detail("Brand",unit.brand)}${detail("Model",unit.model)}${detail("Serial No.",unit.serial)}${detail("Date Acquired",unit.date)}${detail("Supplier",unit.supplier)}${detail("Amount",`₱${amount}`)}</ul><div class="par-other-info"><b>Other Info:</b><p>${escapeFormValue(unit.otherInfo||"")}</p></div></td><td>${escapeFormValue(unit.number||"Pending property number")}</td></tr></tbody></table>
    <div class="par-signatures">${signature("Received From:",unit.issuedBy,unit.issuedByPosition)}${signature("Received By:",unit.employee,unit.position)}</div>
  </article>`;
}

function disposalEligiblePropertyEntries(){
  return acceptedAccountablePropertyUnits().filter(({unit})=>unit.status==="Unserviceable"||unit.status==="Disposed"||unit.condition==="Unserviceable");
}
function disposalEmployeeControl(kind,field,label,selected){
  return `<label>${label}<select data-disposal-form="${kind}" data-disposal-field="${field}"><option value="">Select employee</option>${propertyEmployeeOptions(selected)}</select><small>${escapeFormValue(employeePosition(selected)||"Position will appear after selection")}</small></label>`;
}
function officialNumber(value,blank=""){
  return value===null||value===undefined||value===""?blank:Number(value).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2});
}
function propertyReportDescription(unit){
  const itemDescription=unit.description||unit.item||"";
  const detail=(label,value)=>`<span><b>${label}:</b> ${escapeFormValue(value||"N/A")}</span>`;
  return `<div class="report-item-description"><strong>${escapeFormValue(itemDescription)}</strong>${detail("Brand",unit.brand)}${detail("Model",unit.model)}${detail("Serial No.",unit.serial)}</div>`;
}
function disposalFormHeading(title,description){
  return `<section class="page-heading no-print"><div><h2>${title}</h2><p>${description}</p></div><button class="primary-button" data-print>Print form</button></section>`;
}
function wasteMaterialsReport(){
  const state=disposalFormStates.wmr;
  const entries=disposalEligiblePropertyEntries();
  const rows=entries.map(({unit},index)=>`<tr><td>${index+1}</td><td>1</td><td>${escapeFormValue(unit.uom||"Unit")}</td><td>${propertyReportDescription(unit)}</td><td>${escapeFormValue(unit.officialReceiptNo||"")}</td><td>${escapeFormValue(unit.officialReceiptDate||"")}</td><td class="number-cell">${officialNumber(unit.saleAmount)}</td></tr>`).join("");
  const blanks=Array.from({length:Math.max(0,10-entries.length)},(_,index)=>`<tr class="blank-disposal-row"><td>${entries.length+index+1}</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`).join("");
  const employeeName=value=>escapeFormValue(value||"____________________________");
  const disposalCount=entries.length;
  return `${disposalFormHeading("Appendix 65 — Waste Materials Report","Includes property units marked Unserviceable or Disposed. Complete the disposal and signatory details before printing.")}<section class="panel disposal-form-controls no-print"><div class="form-grid thirds"><label>Place of storage<input data-disposal-form="wmr" data-disposal-field="place" value="${escapeFormValue(state.place)}"></label><label>Date<input type="date" data-disposal-form="wmr" data-disposal-field="date" value="${escapeFormValue(state.date)}"></label><label>Disposal method<select data-disposal-form="wmr" data-disposal-field="disposalMethod">${["Destroyed","Sold at private sale","Sold at public auction","Transferred without cost"].map(value=>`<option ${value===state.disposalMethod?"selected":""}>${value}</option>`).join("")}</select></label><label>Receiving agency, if transferred<input data-disposal-form="wmr" data-disposal-field="transferAgency" value="${escapeFormValue(state.transferAgency)}"></label>${disposalEmployeeControl("wmr","certified","Certified Correct by",state.certified)}${disposalEmployeeControl("wmr","approved","Disposal Approved by",state.approved)}${disposalEmployeeControl("wmr","inspection","Inspection Officer",state.inspection)}${disposalEmployeeControl("wmr","witness","Witness to Disposal",state.witness)}</div></section><article class="disposal-official-form wmr-form"><div class="disposal-appendix">Appendix 65</div><img class="disposal-header" src="/agency-header-placeholder.png" alt="Your Agency official header"><h1>WASTE MATERIALS REPORT</h1><div class="wmr-meta"><p>Entity Name: <strong>${escapeFormValue(window.stockCardEntityName||"Your Agency")}</strong></p><p>Fund Cluster: <strong>Regular Fund 01</strong></p><p>Place of Storage: <strong>${escapeFormValue(state.place||"____________________________")}</strong></p><p>Date: <strong>${physicalReportDate(state.date)}</strong></p></div><div class="wmr-section-title">ITEMS FOR DISPOSAL</div><table class="disposal-table wmr-table"><colgroup><col><col><col><col><col><col><col></colgroup><thead><tr><th rowspan="3">Item</th><th rowspan="3">Quantity</th><th rowspan="3">Unit</th><th rowspan="3">Description</th><th colspan="3">Record of Sales</th></tr><tr><th colspan="3">Official Receipt</th></tr><tr><th>No.</th><th>Date</th><th>Amount</th></tr></thead><tbody>${rows}${blanks}<tr class="total-row"><td colspan="4">TOTAL</td><td></td><td></td><td class="number-cell"></td></tr></tbody></table><div class="wmr-primary-signatures"><section><strong>Certified Correct:</strong><span class="signature-space"></span><b>${employeeName(state.certified)}</b><small>Signature over Printed Name of Supply and/or Property Custodian</small><em>${escapeFormValue(employeePosition(state.certified)||"")}</em></section><section><strong>Disposal Approved:</strong><span class="signature-space"></span><b>${employeeName(state.approved)}</b><small>Signature over Printed Name of Head of Agency/Entity or Authorized Representative</small><em>${escapeFormValue(employeePosition(state.approved)||"")}</em></section></div><section class="wmr-inspection"><h2>CERTIFICATE OF INSPECTION</h2><p>I hereby certify that the property enumerated above was disposed of as follows:</p><ul>${["Destroyed","Sold at private sale","Sold at public auction","Transferred without cost"].map(method=>`<li><span>Item</span><b>${method===state.disposalMethod?disposalCount:"_____"}</b><span>${method}${method==="Transferred without cost"?` to ${escapeFormValue(state.transferAgency||"(Name of the Agency/Entity)")}`:""}</span></li>`).join("")}</ul></section><div class="wmr-secondary-signatures"><section><strong>Certified Correct:</strong><span class="signature-space"></span><b>${employeeName(state.inspection)}</b><small>Signature over Printed Name of Inspection Officer</small><em>${escapeFormValue(employeePosition(state.inspection)||"")}</em></section><section><strong>Witness to Disposal:</strong><span class="signature-space"></span><b>${employeeName(state.witness)}</b><small>Signature over Printed Name of Witness</small><em>${escapeFormValue(employeePosition(state.witness)||"")}</em></section></div></article>`;
}
function unserviceablePropertyReport(){
  const state=disposalFormStates.iirup;
  const entries=disposalEligiblePropertyEntries();
  const rows=entries.map(({unit})=>{const cost=Number(unit.cost||0);const depreciation=Number(unit.accumulatedDepreciation||0);const impairment=Number(unit.impairmentLosses||0);const carrying=Math.max(0,cost-depreciation-impairment);const method=unit.disposalMethod||"";return `<tr data-property-unit-id="${escapeFormValue(unit.dbId||"")}"><td>${escapeFormValue(unit.date||"")}</td><td>${propertyReportDescription(unit)}</td><td>${escapeFormValue(unit.number||unit.inventoryNumber||"")}</td><td class="number-cell">1</td><td class="number-cell">${officialNumber(cost)}</td><td class="number-cell">${officialNumber(cost)}</td><td class="number-cell">${depreciation?officialNumber(depreciation):""}</td><td class="number-cell">${impairment?officialNumber(impairment):""}</td><td class="number-cell">${officialNumber(carrying)}</td><td>${escapeFormValue([unit.status,unit.condition].filter(Boolean).join(" · "))}</td><td class="center-cell">${method==="Sale"?"1":""}</td><td class="center-cell">${unit.status==="Transferred"?"1":""}</td><td class="center-cell">${method==="Destruction"?"1":""}</td><td>${escapeFormValue(method&&!['Sale','Destruction'].includes(method)?method:"")}</td><td class="number-cell">${unit.status==="Disposed"||unit.status==="Transferred"?"1":""}</td><td class="number-cell">${officialNumber(unit.appraisedValue)}</td><td>${escapeFormValue(unit.officialReceiptNo||"")}</td><td class="number-cell">${officialNumber(unit.saleAmount)}</td></tr>`}).join("");
  const blanks=Array.from({length:Math.max(0,12-entries.length)},()=>`<tr class="blank-disposal-row">${Array.from({length:18},()=>"<td></td>").join("")}</tr>`).join("");
  const name=value=>escapeFormValue(value||"____________________________");
  return `${disposalFormHeading("Appendix 74 — IIRUP","Automatically lists property units marked Unserviceable or Disposed. Enter the report date, accountable officer, station, and signatories.")}<section class="panel disposal-form-controls no-print"><div class="form-grid thirds"><label>As at<input type="date" data-disposal-form="iirup" data-disposal-field="asOf" value="${escapeFormValue(state.asOf)}"></label>${disposalEmployeeControl("iirup","accountable","Accountable Officer",state.accountable)}<label>Station<input data-disposal-form="iirup" data-disposal-field="station" value="${escapeFormValue(state.station)}"></label>${disposalEmployeeControl("iirup","approved","Authorized Official",state.approved)}${disposalEmployeeControl("iirup","inspection","Inspection Officer",state.inspection)}${disposalEmployeeControl("iirup","witness","Witness",state.witness)}</div></section><article class="disposal-official-form iirup-form"><div class="disposal-appendix">Appendix 74</div><img class="disposal-header" src="/agency-header-placeholder.png" alt="Your Agency official header"><h1>INVENTORY AND INSPECTION REPORT OF UNSERVICEABLE PROPERTY</h1><p class="disposal-as-of">As at <strong>${physicalReportDate(state.asOf)}</strong></p><div class="iirup-meta"><p>Entity Name: <strong>${escapeFormValue(window.stockCardEntityName||"Your Agency")}</strong></p><p>Fund Cluster: <strong>Regular Fund 01</strong></p><p><strong>${name(state.accountable)}</strong><small>(Name of Accountable Officer)</small></p><p><strong>${escapeFormValue(employeePosition(state.accountable)||"____________________")}</strong><small>(Designation)</small></p><p><strong>${escapeFormValue(state.station||"____________________")}</strong><small>(Station)</small></p></div><table class="disposal-table iirup-table"><thead><tr><th colspan="10">INVENTORY</th><th colspan="8">INSPECTION AND DISPOSAL</th></tr><tr><th rowspan="2">Date<br>Acquired</th><th rowspan="2">Particulars /<br>Articles</th><th rowspan="2">Property<br>No.</th><th rowspan="2">Qty.</th><th rowspan="2">Unit<br>Cost</th><th rowspan="2">Total<br>Cost</th><th rowspan="2">Accumulated<br>Depreciation</th><th rowspan="2">Accumulated<br>Impairment Losses</th><th rowspan="2">Carrying<br>Amount</th><th rowspan="2">Remarks</th><th colspan="5">DISPOSAL</th><th rowspan="2">Appraised<br>Value</th><th colspan="2">RECORD OF SALES</th></tr><tr><th>Sale</th><th>Transfer</th><th>Destruction</th><th>Others<br>(Specify)</th><th>Total</th><th>OR No.</th><th>Amount</th></tr><tr class="column-numbers">${Array.from({length:18},(_,index)=>`<th>(${index+1})</th>`).join("")}</tr></thead><tbody>${rows}${blanks}</tbody></table><div class="iirup-certifications"><section class="request-block"><p>I HEREBY request inspection and disposition, pursuant to Section 79 of PD 1445, of the property enumerated above.</p><div class="iirup-request-signatures"><div><strong>Requested by:</strong><span></span><b>${name(state.accountable)}</b><small>Signature over Printed Name of Accountable Officer</small><em>${escapeFormValue(employeePosition(state.accountable)||"Designation")}</em></div><div><strong>Approved by:</strong><span></span><b>${name(state.approved)}</b><small>Signature over Printed Name of Authorized Official</small><em>${escapeFormValue(employeePosition(state.approved)||"Designation")}</em></div></div></section><section><p>I CERTIFY that I have inspected each and every article enumerated in this report, and that the disposition made thereof was, in my judgment, the best for the public interest.</p><span class="certification-space"></span><b>${name(state.inspection)}</b><small>Signature over Printed Name of Inspection Officer</small><em>${escapeFormValue(employeePosition(state.inspection)||"")}</em></section><section><p>I CERTIFY that I have witnessed the disposition of the articles enumerated on this report.</p><span class="certification-space"></span><b>${name(state.witness)}</b><small>Signature over Printed Name of Witness</small><em>${escapeFormValue(employeePosition(state.witness)||"")}</em></section></div></article>`;
}
function lostStolenDamagedPropertyReport(){
  const state=disposalFormStates.rlsddp;
  const entries=acceptedAccountablePropertyUnits();
  if(!state.propertyKey&&entries.length)state.propertyKey=entries[0].key;
  const selected=entries.find(entry=>entry.key===state.propertyKey)||entries[0];
  if(!selected)return `${disposalFormHeading("Appendix 75 — RLSDDP","Prepare a report for a selected accountable property unit.")}<div class="empty-state"><span>75</span><h3>No accountable property records</h3><p>Complete an accepted IAR for Semi-Expendable or Capital Outlay property first.</p></div>`;
  const unit=selected.unit;
  const accountable=unit.employee||"";
  const accountablePosition=unit.position||employeePosition(accountable)||"";
  const checked=value=>state.status===value?"☒":"☐";
  const police=value=>state.policeNotified===value?"☒":"☐";
  const selector=entries.map(entry=>`<option value="${escapeFormValue(entry.key)}" ${entry.key===state.propertyKey?"selected":""}>${escapeFormValue(propertyUnitLabel(entry))}</option>`).join("");
  return `${disposalFormHeading("Appendix 75 — RLSDDP","Select one accountable property unit and complete the incident, police, certification, and notarial details.")}<section class="panel disposal-form-controls no-print"><div class="form-grid thirds"><label>Property unit<select data-disposal-form="rlsddp" data-disposal-field="propertyKey">${selector}</select></label><label>RLSDDP No.<input data-disposal-form="rlsddp" data-disposal-field="number" value="${escapeFormValue(state.number)}"></label><label>RLSDDP Date<input type="date" data-disposal-form="rlsddp" data-disposal-field="date" value="${escapeFormValue(state.date)}"></label><label>Status of Property<select data-disposal-form="rlsddp" data-disposal-field="status">${["Lost","Stolen","Damaged","Destroyed"].map(value=>`<option ${value===state.status?"selected":""}>${value}</option>`).join("")}</select></label><label>Police notified<select data-disposal-form="rlsddp" data-disposal-field="policeNotified"><option ${state.policeNotified==="Yes"?"selected":""}>Yes</option><option ${state.policeNotified==="No"?"selected":""}>No</option></select></label><label>Police station<input data-disposal-form="rlsddp" data-disposal-field="policeStation" value="${escapeFormValue(state.policeStation)}"></label><label>Police notification date<input type="date" data-disposal-form="rlsddp" data-disposal-field="policeDate" value="${escapeFormValue(state.policeDate)}"></label>${disposalEmployeeControl("rlsddp","supervisor","Immediate Supervisor",state.supervisor)}<label class="wide">Circumstances<textarea data-disposal-form="rlsddp" data-disposal-field="circumstances">${escapeFormValue(state.circumstances)}</textarea></label><label>Accountable Officer date<input type="date" data-disposal-form="rlsddp" data-disposal-field="accountableDate" value="${escapeFormValue(state.accountableDate)}"></label><label>Supervisor date<input type="date" data-disposal-form="rlsddp" data-disposal-field="supervisorDate" value="${escapeFormValue(state.supervisorDate)}"></label><label>Government Issued ID<input data-disposal-form="rlsddp" data-disposal-field="governmentId" value="${escapeFormValue(state.governmentId)}"></label><label>ID No.<input data-disposal-form="rlsddp" data-disposal-field="idNumber" value="${escapeFormValue(state.idNumber)}"></label><label>Date Issued<input type="date" data-disposal-form="rlsddp" data-disposal-field="idDate" value="${escapeFormValue(state.idDate)}"></label><label>Sworn day<input data-disposal-form="rlsddp" data-disposal-field="swornDay" value="${escapeFormValue(state.swornDay)}"></label><label>Sworn month<input data-disposal-form="rlsddp" data-disposal-field="swornMonth" value="${escapeFormValue(state.swornMonth)}"></label><label>Sworn year<input data-disposal-form="rlsddp" data-disposal-field="swornYear" value="${escapeFormValue(state.swornYear)}"></label><label>Doc. No.<input data-disposal-form="rlsddp" data-disposal-field="docNumber" value="${escapeFormValue(state.docNumber)}"></label><label>Page No.<input data-disposal-form="rlsddp" data-disposal-field="pageNumber" value="${escapeFormValue(state.pageNumber)}"></label><label>Book No.<input data-disposal-form="rlsddp" data-disposal-field="bookNumber" value="${escapeFormValue(state.bookNumber)}"></label><label>Series of<input data-disposal-form="rlsddp" data-disposal-field="series" value="${escapeFormValue(state.series)}"></label></div></section><article class="disposal-official-form rlsddp-form"><div class="disposal-appendix">Appendix 75</div><img class="disposal-header" src="/agency-header-placeholder.png" alt="Your Agency official header"><h1>REPORT OF LOST, STOLEN, DAMAGED OR DESTROYED PROPERTY</h1><div class="rlsddp-entity"><p>Entity Name: <strong>${escapeFormValue(window.stockCardEntityName||"Your Agency")}</strong></p><p>Fund Cluster: <strong>Regular Fund 01</strong></p></div><div class="rlsddp-details"><div><p><b>Department/Office:</b> ${escapeFormValue(unit.office||unit.department||"____________________")}</p><p><b>Accountable Officer:</b> ${escapeFormValue(accountable||"____________________")}</p><p><b>Designation:</b> ${escapeFormValue(accountablePosition||"____________________")}</p><div class="police-grid"><p><b>Police Notified:</b> ${police("Yes")} Yes &nbsp; ${police("No")} No</p><p><b>Police Station:</b> ${escapeFormValue(state.policeStation||"____________________")}</p><p><b>Date:</b> ${physicalReportDate(state.policeDate)}</p></div></div><div><p><b>RLSDDP No.:</b> ${escapeFormValue(state.number||"____________")}</p><p><b>RLSDDP Date:</b> ${physicalReportDate(state.date)}</p><p><b>PAR No.:</b> ${escapeFormValue(unit.parNumber||unit.icsNumber||"____________")}</p><p><b>PAR Date:</b> ${escapeFormValue(unit.date||"____________")}</p></div></div><section class="rlsddp-status"><strong>Status of Property: (check applicable box)</strong><div><span>${checked("Lost")} Lost</span><span>${checked("Damaged")} Damaged</span><span>${checked("Stolen")} Stolen</span><span>${checked("Destroyed")} Destroyed</span></div></section><table class="disposal-table rlsddp-table"><thead><tr><th>Property No.</th><th>Description</th><th>Acquisition Cost</th></tr></thead><tbody><tr><td>${escapeFormValue(unit.number||unit.inventoryNumber||"")}</td><td><strong>${escapeFormValue(unit.item||"")}</strong><small>${escapeFormValue([unit.brand,unit.model,unit.serial&&`SN: ${unit.serial}`].filter(Boolean).join(" · "))}</small></td><td class="number-cell">${officialNumber(unit.cost)}</td></tr>${Array.from({length:5},()=>"<tr class=\"blank-disposal-row\"><td></td><td></td><td></td></tr>").join("")}</tbody></table><section class="rlsddp-circumstances"><strong>Circumstances:</strong><p>${escapeFormValue(state.circumstances||"")}</p></section><div class="rlsddp-certification"><section><p>I hereby certify that the item/s and circumstances stated above are true and correct.</p><span class="signature-space"></span><b>${escapeFormValue(accountable||"____________________________")}</b><small>Signature over Printed Name of the Accountable Officer</small><em>${physicalReportDate(state.accountableDate)}</em><small>Date</small><div class="id-details"><p>Government Issued ID: <strong>${escapeFormValue(state.governmentId||"________________")}</strong></p><p>ID No.: <strong>${escapeFormValue(state.idNumber||"________________")}</strong></p><p>Date Issued: <strong>${physicalReportDate(state.idDate)}</strong></p></div></section><section><p>Noted by:</p><span class="signature-space"></span><b>${escapeFormValue(state.supervisor||"____________________________")}</b><small>Signature over Printed Name of the Immediate Supervisor</small><em>${physicalReportDate(state.supervisorDate)}</em><small>Date</small></section></div><section class="rlsddp-notary"><p><strong>SUBSCRIBED AND SWORN</strong> to before me this <b>${escapeFormValue(state.swornDay||"____")}</b> day of <b>${escapeFormValue(state.swornMonth||"________")}</b>, <b>${escapeFormValue(state.swornYear||"____")}</b>, affiant exhibiting the above government issued identification card.</p><div><ul><li>Doc. No. ${escapeFormValue(state.docNumber||"________")}</li><li>Page No. ${escapeFormValue(state.pageNumber||"________")}</li><li>Book No. ${escapeFormValue(state.bookNumber||"________")}</li><li>Series of ${escapeFormValue(state.series||"________")}</li></ul><span>Notary Public</span></div></section></article>`;
}

function physicalReportCategories(classification){
  return masters.UACS
    .filter(row=>row[2]===classification&&row[5]!=="Inactive")
    .map(row=>({code:String(row[0]||""),title:String(row[1]||"")}))
    .filter(row=>row.code||row.title)
    .sort((a,b)=>`${a.title} ${a.code}`.localeCompare(`${b.title} ${b.code}`,undefined,{sensitivity:"base",numeric:true}));
}

function propertyUnitUacs(unit){
  if(unit.uacsCode)return String(unit.uacsCode);
  const item=masters.Items.find(row=>row[1]===unit.item||row[1]===unit.description);
  return String(item?.[4]||"");
}

function stockCardUacs(card){
  const item=masters.Items.find(row=>String(row[0])===String(card.stockNumber)||row[1]===card.item||row[1]===card.description);
  return String(item?.[4]||"");
}

function physicalReportDate(value){
  if(!value)return "____________________";
  const parsed=new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())?escapeFormValue(value):parsed.toLocaleDateString("en-PH",{month:"long",day:"numeric",year:"numeric"});
}

function physicalReportControls(kind,title,categories){
  const state=physicalReportStates[kind];
  if(!categories.some(category=>category.code===state.category))state.category=categories[0]?.code||"";
  const employeeSelect=(field,label)=>`<label>${label}<select data-physical-report="${kind}" data-physical-field="${field}"><option value="">Select employee</option>${propertyEmployeeOptions(state[field])}</select><small>${escapeFormValue(employeePosition(state[field])||"Position will appear after selection")}</small></label>`;
  return `<section class="page-heading no-print"><div><h2>${title}</h2><p>Select a category, enter the As of date manually, and choose the official signatories.</p></div><button class="primary-button" data-print>Print form</button></section><section class="panel physical-report-controls no-print"><div class="form-grid thirds"><label>Category<select data-physical-report="${kind}" data-physical-field="category">${categories.length?categories.map(category=>`<option value="${escapeFormValue(category.code)}" ${category.code===state.category?"selected":""}>${escapeFormValue(`${category.code} — ${category.title}`)}</option>`).join(""):`<option value="">No category available</option>`}</select></label><label>As of date<input type="date" data-physical-report="${kind}" data-physical-field="asOf" value="${escapeFormValue(state.asOf)}"></label>${employeeSelect("certified","Certified Correct by")}${employeeSelect("approved","Approved by")}${employeeSelect("verified","Verified by")}</div><p class="field-hint">The As of date is not automated. It stays blank until you select it.</p></section>`;
}

function physicalReportSignatures(state){
  const signature=(label,name)=>`<section><strong>${label}</strong><span class="signature-space"></span><b>${escapeFormValue(name||"____________________________")}</b><small>Signature over printed name</small><em>${escapeFormValue(employeePosition(name)||"Position")}</em></section>`;
  return `<div class="physical-report-signatures">${signature("Certified Correct by:",state.certified)}${signature("Approved by:",state.approved)}${signature("Verified by:",state.verified)}</div>`;
}

function rcpiReport(){
  const kind="rcpi";
  const state=physicalReportStates[kind];
  const categories=physicalReportCategories("Expendable");
  if(!categories.some(category=>category.code===state.category))state.category=categories[0]?.code||"";
  const selected=categories.find(category=>category.code===state.category)||{code:"",title:"Inventory"};
  const rows=buildAppendix58Cards().map(card=>({card,last:card.transactions.at(-1),firstDate:card.transactions[0]?.isoDate||""})).filter(entry=>entry.last&&entry.last.balance>0&&stockCardUacs(entry.card)===state.category).sort((a,b)=>String(a.firstDate).localeCompare(String(b.firstDate))||String(a.card.stockNumber||"").localeCompare(String(b.card.stockNumber||""),undefined,{sensitivity:"base",numeric:true})||a.card.item.localeCompare(b.card.item,undefined,{sensitivity:"base",numeric:true}));
  const dataRows=rows.map(({card,last})=>`<tr><td>${escapeFormValue(card.item)}</td><td>${escapeFormValue(card.description)}</td><td>${escapeFormValue(card.stockNumber)}</td><td>${escapeFormValue(card.uom)}</td><td class="number-cell">${Number(last.balanceUnitCost||0).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</td><td class="number-cell">${Number(last.balance||0).toLocaleString("en-PH")}</td><td class="number-cell">${Number(last.balance||0).toLocaleString("en-PH")}</td><td class="number-cell">0</td><td class="number-cell">0.00</td><td></td></tr>`).join("");
  const blanks=Array.from({length:Math.max(0,14-rows.length)},()=>`<tr>${Array.from({length:10},()=>"<td>&nbsp;</td>").join("")}</tr>`).join("");
  const total=rows.reduce((sum,entry)=>sum+Number(entry.last.balanceValue||0),0);
  return `${physicalReportControls(kind,"Appendix 66 — RCPI",categories)}<article class="physical-report-form rcpi-form"><div class="physical-report-appendix">Appendix 66</div><img class="physical-report-header" src="/agency-header-placeholder.png" alt="Your Agency official header"><h1>REPORT ON THE PHYSICAL COUNT OF INVENTORIES</h1><h2>${escapeFormValue(`${selected.code} - ${selected.title}`)}</h2><p class="physical-report-type">(Type of Inventory Item)</p><p class="physical-report-asof">As of ${physicalReportDate(state.asOf)}</p><p><strong>Fund Cluster:</strong> Regular Fund 01</p><p class="accountability-line">For which <strong>${escapeFormValue(state.certified||"____________________________")}</strong>, <strong>${escapeFormValue(employeePosition(state.certified)||"____________________________")}</strong>, ${escapeFormValue(window.stockCardEntityName||"Your Agency").toUpperCase()} is accountable.</p><table class="physical-count-table rcpi-table"><thead><tr><th rowspan="2">Article</th><th rowspan="2">Description</th><th rowspan="2">Stock<br>Number</th><th rowspan="2">Unit of<br>Measure</th><th rowspan="2">Unit<br>Value</th><th rowspan="2">Balance Per Card<br>(Quantity)</th><th rowspan="2">On Hand Per Count<br>(Quantity)</th><th colspan="2"><span class="shortage-overage-heading">Shortage / Overage</span></th><th rowspan="2">Remarks</th></tr><tr><th>Quantity</th><th>Value</th></tr></thead><tbody>${dataRows}${blanks}</tbody></table><div class="rcpi-total-amount"><span>TOTAL AMOUNT</span><strong>${total.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></div>${physicalReportSignatures(state)}</article>`;
}

function rpcppeReport(){
  const kind="rpcppe";
  const state=physicalReportStates[kind];
  const categories=physicalReportCategories("Capital Outlay");
  if(!categories.some(category=>category.code===state.category))state.category=categories[0]?.code||"";
  const selected=categories.find(category=>category.code===state.category)||{code:"",title:"Property, Plant and Equipment"};
  const rows=propertyUnits.filter(unit=>unit.classification==="Capital Outlay"&&propertyUnitUacs(unit)===state.category).sort((a,b)=>String(a.number||"").localeCompare(String(b.number||""),undefined,{numeric:true,sensitivity:"base"})||String(a.item||"").localeCompare(String(b.item||""),undefined,{sensitivity:"base"}));
  const dataRows=rows.map(unit=>{const physical=unit.status==="Disposed"?0:1;const difference=physical-1;return `<tr data-property-unit-id="${escapeFormValue(unit.dbId||"")}"><td>${escapeFormValue(unit.item)}</td><td>${propertyReportDescription(unit)}</td><td>${escapeFormValue(unit.number||"")}</td><td>${escapeFormValue(unit.uom||"Unit")}</td><td class="number-cell">${Number(unit.cost||0).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</td><td class="number-cell">1</td><td class="number-cell">${physical}</td><td class="number-cell">${difference}</td><td class="number-cell">${(difference*Number(unit.cost||0)).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</td><td>${escapeFormValue([unit.status,unit.condition].filter(Boolean).join(" · "))}</td></tr>`}).join("");
  const blanks=Array.from({length:Math.max(0,14-rows.length)},()=>`<tr>${Array.from({length:10},()=>"<td>&nbsp;</td>").join("")}</tr>`).join("");
  const total=rows.reduce((sum,unit)=>sum+Number(unit.cost||0),0);
  return `${physicalReportControls(kind,"Appendix 73 — RPCPPE",categories)}<article class="physical-report-form rpcppe-form"><div class="physical-report-appendix">Appendix 73</div><img class="physical-report-header" src="/agency-header-placeholder.png" alt="Your Agency official header"><h1>REPORT ON THE PHYSICAL COUNT OF PROPERTY, PLANT AND EQUIPMENT</h1><h2>${escapeFormValue(`${selected.code} - ${selected.title}`)}</h2><p class="physical-report-type">(Type of Property, Plant and Equipment)</p><p class="physical-report-asof">As of ${physicalReportDate(state.asOf)}</p><p><strong>Fund Cluster:</strong> Regular Fund 01</p><p class="accountability-line">For which <strong>${escapeFormValue(state.certified||"____________________________")}</strong>, <strong>${escapeFormValue(employeePosition(state.certified)||"____________________________")}</strong>, ${escapeFormValue(window.stockCardEntityName||"Your Agency").toUpperCase()} is accountable.</p><table class="physical-count-table rpcppe-table"><thead><tr><th rowspan="2">Article</th><th rowspan="2">Description</th><th rowspan="2">Property<br>Number</th><th rowspan="2">Unit of<br>Measure</th><th rowspan="2">Unit<br>Value</th><th colspan="2">Quantity</th><th colspan="2"><span class="shortage-overage-heading">Shortage / Overage</span></th><th rowspan="2">Remarks</th></tr><tr><th>Per Property<br>Card</th><th>Per Physical<br>Count</th><th>Quantity</th><th>Value</th></tr></thead><tbody>${dataRows}${blanks}<tr class="total-row"><td colspan="4">TOTAL AMOUNT</td><td class="number-cell">${total.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</td><td colspan="5"></td></tr></tbody></table>${physicalReportSignatures(state)}</article>`;
}

function semiExpendableRegistryReport(){
  const kind="semiRegistry";
  const state=physicalReportStates[kind];
  const categories=physicalReportCategories("Semi-Expendable");
  if(!categories.some(category=>category.code===state.category))state.category=categories[0]?.code||"";
  const selected=categories.find(category=>category.code===state.category)||{code:"",title:"Semi-Expendable Property"};
  const rows=propertyUnits.filter(unit=>unit.classification==="Semi-Expendable"&&propertyUnitUacs(unit)===state.category&&(unit.icsNumber||unit.employee||unit.status==="Issued"||unit.status==="Returned"||unit.status==="Disposed")).sort((a,b)=>String(a.number||a.isoDate||"").localeCompare(String(b.number||b.isoDate||""),undefined,{numeric:true,sensitivity:"base"})||String(a.inventoryNumber||"").localeCompare(String(b.inventoryNumber||""),undefined,{numeric:true,sensitivity:"base"}));
  const dataRows=rows.map(unit=>{const returned=unit.status==="Returned"?1:0;const disposed=unit.status==="Disposed"?1:0;const balance=disposed||returned?0:1;return `<tr data-property-unit-id="${escapeFormValue(unit.dbId||"")}"><td>${escapeFormValue(unit.issuedDate||unit.date||"")}</td><td>${escapeFormValue(unit.icsNumber||"")}</td><td>${escapeFormValue(unit.inventoryNumber||unit.number||"")}</td><td>${propertyReportDescription(unit)}</td><td>${escapeFormValue(unit.date||"")}</td><td>${escapeFormValue(unit.employee||"")}</td><td>${escapeFormValue(unit.office||"")}</td><td>${escapeFormValue(`${unit.usefulLife||5} YRS`)}</td><td class="number-cell">1</td><td>${escapeFormValue(unit.employee||unit.office||"")}</td><td class="number-cell">${returned}</td><td>${returned?escapeFormValue(unit.office||""):""}</td><td class="number-cell">0</td><td></td><td class="number-cell">${disposed}</td><td class="number-cell">${balance}</td><td class="number-cell">${Number(unit.cost||0).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</td><td>${escapeFormValue([unit.status,unit.condition].filter(Boolean).join(" · "))}</td></tr>`}).join("");
  const blanks=Array.from({length:Math.max(0,14-rows.length)},()=>`<tr>${Array.from({length:18},()=>"<td>&nbsp;</td>").join("")}</tr>`).join("");
  const total=rows.reduce((sum,unit)=>sum+Number(unit.cost||0),0);
  return `${physicalReportControls(kind,"Annex A.4 — Semi-Expendable Registry",categories)}<article class="physical-report-form semi-registry-form"><div class="physical-report-appendix">Annex A.4</div><img class="physical-report-header" src="/agency-header-placeholder.png" alt="Your Agency official header"><h1>REGISTRY OF SEMI-EXPENDABLE PROPERTY ISSUED</h1><div class="semi-registry-meta"><p>Entity Name: <strong>${escapeFormValue(window.stockCardEntityName||"Your Agency")}</strong></p><p>Fund Cluster: <strong>Regular Fund 01</strong></p><p>Semi-Expendable Property: <strong>${escapeFormValue(`${selected.code} - ${selected.title}`)}</strong></p><p>As of: <strong>${physicalReportDate(state.asOf)}</strong></p></div><table class="physical-count-table semi-registry-table"><colgroup>${Array.from({length:18},()=>"<col>").join("")}</colgroup><thead><tr><th rowspan="2">Date</th><th rowspan="2">Reference<br>ICS/RRSP No.</th><th rowspan="2">Semi-Expendable<br>Property No.</th><th rowspan="2">Item<br>Description</th><th rowspan="2">Date<br>Acquired</th><th rowspan="2">End-User</th><th rowspan="2">Division</th><th rowspan="2">Estimated<br>Useful Life</th><th colspan="2">Issued</th><th colspan="2">Returned</th><th colspan="2">Re-issued</th><th rowspan="2">Disposed<br>Qty.</th><th rowspan="2">Balance<br>Qty.</th><th rowspan="2">Amount</th><th rowspan="2">Remarks</th></tr><tr><th>Qty.</th><th>Office /<br>Officer</th><th>Qty.</th><th>Office /<br>Officer</th><th>Qty.</th><th>Office /<br>Officer</th></tr></thead><tbody>${dataRows}${blanks}<tr class="total-row"><td colspan="16">TOTAL</td><td class="number-cell">${total.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</td><td></td></tr></tbody></table>${physicalReportSignatures(state)}</article>`;
}

function propertyTransferReport(){
  const entries=capitalPropertyUnits();
  if(!entries.length)return propertyEmptyState("PTR","Appendix 76 Property Transfer Report","Complete an IAR containing a capital-outlay item to create the property record used by this form.");
  ptrSelectedKeys=ptrSelectedKeys.filter(key=>entries.some(entry=>entry.key===key));
  if(!ptrSelectedKeys.length)ptrSelectedKeys=[entries[0].key];
  const selected=entries.filter(entry=>ptrSelectedKeys.includes(entry.key));
  const rows=selected.map(({unit})=>`<tr data-property-unit-id="${escapeFormValue(unit.dbId||"")}"><td>${escapeFormValue(unit.date)}</td><td>${escapeFormValue(unit.number||"")}</td><td>${propertyReportDescription(unit)}</td><td class="number-cell">${Number(unit.cost||0).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</td><td>${escapeFormValue(unit.condition||"")}</td></tr>`).join("");
  const blanks=Array.from({length:Math.max(0,16-selected.length)},()=>`<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>`).join("");
  const signature=(label,name,id)=>`<div><strong>${label}</strong><span class="signature-space"></span><b id="${id}-name">${escapeFormValue(name||"____________________")}</b><small>Printed name and signature</small><span id="${id}-position">${escapeFormValue(employeePosition(name)||"Designation")}</span><small>Designation</small><span>____________________</span><small>Date</small></div>`;
  return `<section class="page-heading no-print"><div><h2>Appendix 76 — Property Transfer Report</h2><p>Select capital-outlay property records, complete the transfer details, and print the official form.</p></div><button class="primary-button" data-print>Print transfer report</button></section>
  <section class="panel ptr-controls no-print"><div><h3>Property records to include</h3><p>Only capital-outlay records are eligible for Appendix 76.</p></div><div class="ptr-property-list">${entries.map(entry=>`<label><input type="checkbox" data-ptr-property="${escapeFormValue(entry.key)}" ${ptrSelectedKeys.includes(entry.key)?"checked":""}> <span>${escapeFormValue(propertyUnitLabel(entry))}</span></label>`).join("")}</div><div class="form-grid thirds"><label>PTR No.<input data-ptr-state="number" value="${escapeFormValue(ptrState.number)}" placeholder="Enter PTR number"></label><label>Date<input data-ptr-state="date" type="date" value="${escapeFormValue(ptrState.date)}"></label><label>Transfer type<select data-ptr-state="type">${["Donation","Relocate","Reassignment","Others"].map(type=>`<option ${type===ptrState.type?"selected":""}>${type}</option>`).join("")}</select></label><label>From accountable officer<select data-ptr-state="from"><option value="">Select employee</option>${propertyEmployeeOptions(ptrState.from)}</select></label><label>To accountable officer<select data-ptr-state="to"><option value="">Select employee</option>${propertyEmployeeOptions(ptrState.to)}</select></label><label>Others (specify)<input data-ptr-state="otherType" value="${escapeFormValue(ptrState.otherType)}"></label><label class="wide">Reason for transfer<textarea data-ptr-state="reason">${escapeFormValue(ptrState.reason)}</textarea></label><label>Approved by<select data-ptr-signatory="approved" data-ptr-state="approved"><option value="">Select employee</option>${propertyEmployeeOptions(ptrState.approved)}</select></label><label>Released/Issued by<select data-ptr-signatory="released" data-ptr-state="released"><option value="">Select employee</option>${propertyEmployeeOptions(ptrState.released)}</select></label><label>Received by<select data-ptr-signatory="received" data-ptr-state="received"><option value="">Select employee</option>${propertyEmployeeOptions(ptrState.received)}</select></label></div></section>
  <article class="property-official-form ptr-form">
    <div class="property-form-appendix">Appendix 76</div><img class="property-form-header" src="/agency-header-placeholder.png" alt="Your Agency official header"><h1>PROPERTY TRANSFER REPORT</h1>
    <div class="property-form-meta two-column"><p>Entity Name: <strong>${escapeFormValue(window.stockCardEntityName||"Your Agency")}</strong></p><p>Fund Cluster: <strong>Regular Fund 01</strong></p></div>
    <div class="ptr-document-meta"><p>From Accountable Officer/Agency/Fund Cluster: <strong id="ptr-from-display">${escapeFormValue(ptrState.from||"____________________________")}</strong></p><p>PTR No.: <strong id="ptr-number-display">${escapeFormValue(ptrState.number||"______________")}</strong></p><p>To Accountable Officer/Agency/Fund Cluster: <strong id="ptr-to-display">${escapeFormValue(ptrState.to||"____________________________")}</strong></p><p>Date: <strong id="ptr-date-display">${escapeFormValue(ptrState.date||"______________")}</strong></p></div>
    <div class="ptr-transfer-types"><strong>Transfer Type: (check only one)</strong>${["Donation","Relocate","Reassignment","Others"].map(type=>`<span><b>${ptrState.type===type?"☒":"☐"}</b> ${type}${type==="Others"&&ptrState.otherType?` (${escapeFormValue(ptrState.otherType)})`:""}</span>`).join("")}</div>
    <table class="property-form-table ptr-table"><thead><tr><th>Date Acquired</th><th>Property No.</th><th>Description</th><th>Amount</th><th>Condition of PPE</th></tr></thead><tbody>${rows}${blanks}</tbody></table>
    <div class="ptr-reason"><strong>Reason for Transfer:</strong><p id="ptr-reason-display">${escapeFormValue(ptrState.reason||" ")}</p></div><div class="ptr-signatures">${signature("Approved by:",ptrState.approved,"ptr-approved")}${signature("Released/Issued by:",ptrState.released,"ptr-released")}${signature("Received by:",ptrState.received,"ptr-received")}</div>
  </article>`;
}

function structureRenderedPropertyReports(){
  const findUnit=number=>propertyUnits.find(unit=>String(unit.number||unit.inventoryNumber||"")===String(number||"").trim());
  const structureRows=(selector,numberCell,descriptionCell)=>{
    document.querySelectorAll(selector).forEach(row=>{
      const cells=row.children;
      const unitId=String(row.dataset.propertyUnitId||"");
      const unit=(unitId&&propertyUnits.find(entry=>String(entry.dbId||"")===unitId))||findUnit(cells[numberCell]?.textContent);
      if(unit&&cells[descriptionCell])cells[descriptionCell].innerHTML=propertyReportDescription(unit);
    });
  };
  structureRows(".rpcppe-table tbody tr:not(.total-row)",2,1);
  structureRows(".semi-registry-table tbody tr:not(.total-row)",2,3);
  structureRows(".iirup-table tbody tr:not(.blank-disposal-row)",2,1);
  structureRows(".ptr-table tbody tr",1,2);
  const disposalEntries=disposalEligiblePropertyEntries();
  document.querySelectorAll(".wmr-table tbody tr:not(.blank-disposal-row):not(.total-row)").forEach((row,index)=>{
    const unit=disposalEntries[index]?.unit;
    if(unit&&row.children[3])row.children[3].innerHTML=propertyReportDescription(unit);
  });
  const rlsddpUnit=acceptedAccountablePropertyUnits().find(entry=>entry.key===disposalFormStates.rlsddp.propertyKey)?.unit;
  const rlsddpDescription=document.querySelector(".rlsddp-table tbody tr td:nth-child(2)");
  if(rlsddpUnit&&rlsddpDescription)rlsddpDescription.innerHTML=propertyReportDescription(rlsddpUnit);
  const capitalEntries=capitalPropertyUnits();
  const propertyCardUnit=capitalEntries.find(entry=>entry.key===propertyCardKey)?.unit;
  const propertyCardDescription=document.querySelector(".property-card-details .wide");
  if(propertyCardUnit&&propertyCardDescription)propertyCardDescription.innerHTML=`<span>Description:</span>${propertyReportDescription(propertyCardUnit)}`;
  const ppeLedgerUnit=capitalEntries.find(entry=>entry.key===ppeLedgerKey)?.unit;
  const ppeLedgerDescription=document.querySelector(".ppelc-details p:nth-child(3)");
  if(ppeLedgerUnit&&ppeLedgerDescription)ppeLedgerDescription.innerHTML=`<span>Description:</span>${propertyReportDescription(ppeLedgerUnit)}`;
}

function bindEnhanced(){
  structureRenderedPropertyReports();
  document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>render(b.dataset.go));
  document.querySelectorAll("[data-open-report]").forEach(b=>b.onclick=()=>openReportDestination(b.dataset.openReport));
  document.querySelector("#forms-report-select")?.addEventListener("change",event=>{formTab=event.target.value;render("Forms")});
  if(window.sinopDashboardClock)clearInterval(window.sinopDashboardClock);
  const updatePhilippineClock=()=>{
    const now=new Date();
    const time=document.querySelector("#ph-live-time");
    const date=document.querySelector("#ph-live-date");
    if(time)time.textContent=new Intl.DateTimeFormat("en-PH",{timeZone:"Asia/Manila",hour:"numeric",minute:"2-digit",second:"2-digit",hour12:true}).format(now);
    if(date)date.textContent=`${new Intl.DateTimeFormat("en-PH",{timeZone:"Asia/Manila",weekday:"long",month:"long",day:"numeric",year:"numeric"}).format(now)} · Asia/Manila`;
  };
  if(document.querySelector("#ph-live-time")){updatePhilippineClock();window.sinopDashboardClock=setInterval(updatePhilippineClock,1000)}
  document.querySelector("#dashboard-stock-search")?.addEventListener("input",event=>{
    const query=event.target.value.trim().toLowerCase();let visible=0;
    document.querySelectorAll("[data-dashboard-stock-row]").forEach(row=>{const show=!query||row.dataset.search.includes(query);row.hidden=!show;if(show)visible+=1});
    const empty=document.querySelector("#dashboard-stock-empty");if(empty)empty.hidden=visible!==0;
    const count=document.querySelector("#dashboard-stock-count");if(count)count.textContent=`${visible} item${visible===1?"":"s"}`;
  });
  document.querySelector("#new-po")?.addEventListener("click",openPO);
  document.querySelector("#po-search")?.addEventListener("input",e=>{const q=e.target.value.toLowerCase();document.querySelector("#po-table").innerHTML=poDetailTable(pos.filter(r=>(r[0]+" "+r[2]).toLowerCase().includes(q)));bindEnhanced()});
  document.querySelectorAll("[data-view-po]").forEach(b=>b.onclick=()=>openPOView(+b.dataset.viewPo));
  document.querySelectorAll("[data-edit-po]").forEach(b=>b.onclick=()=>openPOEdit(+b.dataset.editPo));
  document.querySelectorAll("[data-delete-po]").forEach(b=>b.onclick=()=>deletePO(+b.dataset.deletePo));
  document.querySelectorAll("[data-unpost-po]").forEach(b=>b.onclick=()=>unpostPO(+b.dataset.unpostPo));
  document.querySelectorAll("[data-iar]").forEach(b=>b.onclick=()=>openIARForm(+b.dataset.iar));
  document.querySelectorAll("[data-process]").forEach(b=>b.onclick=()=>{if(confirm("Complete this IAR and create inventory or property records? This action cannot be processed twice.")){iars[+b.dataset.process][5]="Capital Outlay";iars[+b.dataset.process][6]="Completed";showToast("IAR completed. Accepted quantities were classified and processed.");render(current)}});
  document.querySelectorAll("[data-view-iar]").forEach(b=>b.onclick=()=>openIARView(+b.dataset.viewIar));
  document.querySelectorAll("[data-unpost-iar]").forEach(b=>b.onclick=()=>unpostIAR(+b.dataset.unpostIar));
  document.querySelectorAll("[data-delete-iar]").forEach(b=>b.onclick=()=>deleteIAR(+b.dataset.deleteIar));
  document.querySelector("#new-ris-form")?.addEventListener("click",openRISForm);
  const filterRis=()=>{const q=(document.querySelector("#ris-search")?.value||"").toLowerCase();const s=document.querySelector("#ris-status")?.value||"All statuses";const rows=risRecords.filter(r=>(r.number+" "+r.office+" "+r.requestedBy).toLowerCase().includes(q)&&(s==="All statuses"||r.status===s));document.querySelector("#ris-table").innerHTML=risTable(rows);bindEnhanced()};
  document.querySelector("#ris-search")?.addEventListener("input",filterRis);document.querySelector("#ris-status")?.addEventListener("change",filterRis);
  document.querySelectorAll("[data-complete-ris]").forEach(b=>b.onclick=()=>openCompleteRIS(+b.dataset.completeRis));
  document.querySelectorAll("[data-edit-ris]").forEach(b=>b.onclick=()=>openRISEdit(+b.dataset.editRis));
  document.querySelectorAll("[data-view-ris]").forEach(b=>b.onclick=()=>viewRIS(+b.dataset.viewRis));
  document.querySelectorAll("[data-unpost-ris]").forEach(b=>b.onclick=()=>unpostRIS(+b.dataset.unpostRis));
  document.querySelectorAll("[data-delete-ris]").forEach(b=>b.onclick=()=>deleteRIS(+b.dataset.deleteRis));
  document.querySelectorAll("[data-ris-print]").forEach(b=>b.onclick=()=>printRIS(+b.dataset.risPrint));
  document.querySelectorAll("[data-property-classification]").forEach(button=>button.onclick=()=>{propertyRecordsMode=button.dataset.propertyClassification;render("Property Records")});
  document.querySelector("[data-property-back]")?.addEventListener("click",()=>{propertyRecordsMode="";render("Property Records")});
  const filterProperty=()=>{const q=(document.querySelector("#property-search")?.value||"").toLowerCase();const s=document.querySelector("#property-status")?.value||"All statuses";const classificationRows=propertyUnits.filter(p=>p.classification===propertyRecordsMode);const rows=classificationRows.filter(p=>([p.number,p.parNumber,p.inventoryNumber,p.icsNumber,p.item,p.brand,p.model,p.serial,p.employee,p.position,p.office,p.po,p.iar].join(" ")).toLowerCase().includes(q)&&(s==="All statuses"||p.status===s));document.querySelector("#property-table").innerHTML=propertyTable(rows,classificationRows.length);bindEnhanced()};
  document.querySelector("#property-search")?.addEventListener("input",filterProperty);document.querySelector("#property-status")?.addEventListener("change",filterProperty);
  document.querySelectorAll("[data-property-menu]").forEach(button=>button.onclick=event=>{
    event.stopPropagation();
    const index=button.dataset.propertyMenu;
    const panel=document.querySelector(`[data-property-menu-panel="${index}"]`);
    const willOpen=Boolean(panel?.hidden);
    document.querySelectorAll("[data-property-menu-panel]").forEach(menu=>{menu.hidden=true});
    document.querySelectorAll("[data-property-menu]").forEach(trigger=>trigger.setAttribute("aria-expanded","false"));
    if(panel&&willOpen){panel.hidden=false;button.setAttribute("aria-expanded","true")}
  });
  document.querySelectorAll("[data-edit-property]").forEach(b=>b.onclick=()=>openPropertyForm(+b.dataset.editProperty));
  document.querySelectorAll("[data-generate-property-qr]").forEach(b=>b.onclick=()=>openPropertyQr(+b.dataset.generatePropertyQr));
  document.querySelectorAll("[data-view-ics]").forEach(b=>b.onclick=()=>{const entry=propertyUnits[+b.dataset.viewIcs];icsPropertyKey=String(entry.dbId||b.dataset.viewIcs);formTab="Appendix 59 (ICS)";render("Forms")});
  document.querySelectorAll("[data-view-par]").forEach(b=>b.onclick=()=>{const entry=propertyUnits[+b.dataset.viewPar];parPropertyKey=String(entry.dbId||b.dataset.viewPar);formTab="Appendix 71 (PAR)";render("Forms")});
  document.querySelectorAll("[data-transfer-property]").forEach(b=>b.onclick=()=>transferProperty(+b.dataset.transferProperty));
  document.querySelectorAll("[data-unserviceable-property]").forEach(b=>b.onclick=()=>markPropertyUnserviceable(+b.dataset.unserviceableProperty));
  document.querySelectorAll("[data-admin-tab]").forEach(b=>b.onclick=async()=>{adminTab=b.dataset.adminTab;if(adminTab==="Activity Log"&&window.reloadInventoryAuditLogs)await window.reloadInventoryAuditLogs();render("Admin Options")});
  const applyActivityFilters=()=>{
    const query=(document.querySelector("#activity-search")?.value||"").trim().toLowerCase();
    const module=document.querySelector("#activity-module-filter")?.value||"";
    const action=document.querySelector("#activity-action-filter")?.value||"";
    let visible=0;
    document.querySelectorAll("#activity-log-rows tr[data-activity-module]").forEach(row=>{
      row.hidden=Boolean((query&&!row.textContent.toLowerCase().includes(query))||(module&&row.dataset.activityModule!==module)||(action&&row.dataset.activityAction!==action));
      if(!row.hidden)visible+=1;
    });
    const empty=document.querySelector("#activity-no-results");
    if(empty)empty.hidden=visible!==0;
    const count=document.querySelector("#activity-visible-count");
    if(count)count.textContent=`${visible} entr${visible===1?"y":"ies"}`;
  };
  document.querySelector("#activity-search")?.addEventListener("input",applyActivityFilters);
  document.querySelector("#activity-module-filter")?.addEventListener("change",applyActivityFilters);
  document.querySelector("#activity-action-filter")?.addEventListener("change",applyActivityFilters);
  const applyMasterFilters=()=>{
    const query=(document.querySelector("#master-search")?.value||"").trim().toLowerCase();
    const classification=document.querySelector("#item-classification-filter")?.value||"All classifications";
    let visible=0;
    document.querySelectorAll("#master-table tbody tr").forEach(row=>{
      const matchesSearch=!query||row.textContent.toLowerCase().includes(query);
      const matchesClassification=classification==="All classifications"||row.dataset.classification===classification;
      row.hidden=!(matchesSearch&&matchesClassification);
      if(!row.hidden)visible+=1;
    });
    const count=document.querySelector("#master-visible-count");
    if(count)count.textContent=`${visible} result${visible===1?"":"s"}`;
  };
  document.querySelector("#master-search")?.addEventListener("input",applyMasterFilters);
  document.querySelector("#item-classification-filter")?.addEventListener("change",applyMasterFilters);
  document.querySelector("#quick-plantilla-form")?.addEventListener("submit",event=>{event.preventDefault();const name=new FormData(event.currentTarget).get("name")?.trim();if(!name)return;if(masters.Plantilla.some(row=>row[0].toLowerCase()===name.toLowerCase())){showToast("That plantilla position already exists.");return}masters.Plantilla.push([name,"Active"]);masters.Plantilla.sort((a,b)=>a[0].localeCompare(b[0]));showToast(`${name} added to Plantilla.`);render("Admin Options")});
  document.querySelector("#quick-employee-form")?.addEventListener("submit",event=>{event.preventDefault();const form=new FormData(event.currentTarget);const name=form.get("name")?.trim();const position=form.get("position")?.trim();if(!name||!position)return;if(masters.Employees.some(row=>row[1].toLowerCase()===name.toLowerCase())){showToast("That employee already exists.");return}masters.Employees.push([`EMP-${String(masters.Employees.length+1).padStart(4,"0")}`,name,position,"","","Active"]);masters.Employees.sort((a,b)=>a[1].localeCompare(b[1]));showToast(`${name} added to Employees.`);render("Admin Options")});
  document.querySelector("#quick-department-form")?.addEventListener("submit",event=>{event.preventDefault();const name=new FormData(event.currentTarget).get("name")?.trim();if(!name)return;if(masters.Departments.some(row=>row[0].toLowerCase()===name.toLowerCase())){showToast("That department already exists.");return}masters.Departments.push([name]);masters.Departments.sort((a,b)=>a[0].localeCompare(b[0]));showToast(`${name} added to Departments.`);render("Admin Options")});
  const settingsForm=document.querySelector("#system-settings-form");
  if(settingsForm){
    let logoData=readTenantSettings().logoPreview||"";let headerData=readTenantSettings().headerPreview||"";
    const readUpload=(input,callback)=>input?.addEventListener("change",()=>{const file=input.files?.[0];if(!file)return;if(file.size>1024*1024){showToast("Please use an image smaller than 1 MB.");input.value="";return}const reader=new FileReader();reader.onload=()=>callback(String(reader.result||""));reader.readAsDataURL(file)});
    readUpload(document.querySelector("#agency-logo-input"),value=>{logoData=value;document.querySelector("#agency-logo-preview").innerHTML=`<img src="${value}" alt="Agency logo preview">`});
    readUpload(document.querySelector("#agency-header-input"),value=>{headerData=value;document.querySelector("#agency-header-preview").innerHTML=`<img src="${value}" alt="Agency header preview">`});
    const syncPalette=()=>{const pickers=[...document.querySelectorAll("[data-tenant-color]")];document.querySelector("#palette-count").textContent=`${pickers.length} / 3`;document.querySelector("#add-tenant-color").disabled=pickers.length>=3;document.querySelector("#remove-tenant-color").disabled=pickers.length<=2;const colors=pickers.map(input=>input.value);const preview=document.querySelector(".palette-live-preview");if(preview){preview.style.setProperty("--preview-one",colors[0]);preview.style.setProperty("--preview-two",colors[1]);preview.style.setProperty("--preview-three",colors[2]||colors[1]);preview.style.color=readableTextFor(colors[0]);const button=preview.querySelector("button");if(button)button.style.color=readableTextFor(colors[1])}};
    const bindColorPair=label=>{const picker=label.querySelector("[data-tenant-color]");const code=label.querySelector("[data-tenant-color-code]");picker.oninput=()=>{code.value=picker.value.toUpperCase();syncPalette()};code.onchange=()=>{if(/^#[0-9a-f]{6}$/i.test(code.value)){picker.value=code.value;syncPalette()}else code.value=picker.value.toUpperCase()}};
    document.querySelectorAll("#tenant-color-pickers label").forEach(bindColorPair);
    document.querySelector("#add-tenant-color")?.addEventListener("click",()=>{const box=document.querySelector("#tenant-color-pickers");if(box.children.length>=3)return;box.insertAdjacentHTML("beforeend",`<label><span>Color 3</span><input type="color" data-tenant-color value="#F59E0B"><input class="color-code" data-tenant-color-code value="#F59E0B" maxlength="7" aria-label="Color 3 hex code"></label>`);bindColorPair(box.lastElementChild);syncPalette()});
    document.querySelector("#remove-tenant-color")?.addEventListener("click",()=>{const box=document.querySelector("#tenant-color-pickers");if(box.children.length>2)box.lastElementChild.remove();syncPalette()});
    syncPalette();
    settingsForm.addEventListener("submit",event=>{event.preventDefault();const form=new FormData(settingsForm);const colors=[...settingsForm.querySelectorAll("[data-tenant-color]")].map(input=>input.value);if(colors.length<2||colors.length>3)return;const previous=readTenantSettings();const next={...previous,agencyName:form.get("agencyName"),agencyAddress:form.get("agencyAddress")?.trim()||"",logoPreview:logoData,headerPreview:headerData,colors,formula:form.get("formula")};try{localStorage.setItem("sinop-tenant-theme",JSON.stringify(next))}catch{showToast("The images are too large to save on this device. Please upload smaller files.");return}window.applySinopTenantTheme?.();const message=document.querySelector("#system-settings-message");if(message)message.textContent="✓ System settings saved and applied.";showToast("System settings saved and applied across Sinop.");setTimeout(()=>render("Admin Options"),650)});
  }
  document.querySelector("#add-master")?.addEventListener("click",()=>openMasterForm(adminTab));
  document.querySelectorAll("[data-edit-master]").forEach(button=>button.onclick=()=>openMasterForm(adminTab,+button.dataset.editMaster));
  document.querySelectorAll("[data-report-tab]").forEach(b=>b.onclick=()=>{reportTab=b.dataset.reportTab;render("Reports")});
  document.querySelectorAll("[data-open-report]").forEach(b=>b.onclick=()=>openReportDestination(b.dataset.openReport));
  document.querySelectorAll("[data-physical-report]").forEach(control=>control.addEventListener("change",event=>{
    const state=physicalReportStates[event.target.dataset.physicalReport];
    if(!state)return;
    state[event.target.dataset.physicalField]=event.target.value;
    rerenderReportSurface();
  }));
  document.querySelectorAll("[data-disposal-form]").forEach(control=>control.addEventListener("change",event=>{
    const state=disposalFormStates[event.target.dataset.disposalForm];
    if(!state)return;
    state[event.target.dataset.disposalField]=event.target.value;
    rerenderReportSurface();
  }));
  const filterInventoryBalance=()=>{
    const query=(document.querySelector("#inventory-balance-search")?.value||"").trim().toLowerCase();
    const rows=[...document.querySelectorAll("#inventory-balance-rows tr[data-inventory-item]")];
    let visible=0;
    rows.forEach(row=>{
      const matches=!query||row.dataset.inventoryItem.toLowerCase().includes(query)||row.dataset.inventoryStock.toLowerCase().includes(query);
      row.hidden=!matches;
      if(matches)visible+=1;
    });
    const noResults=document.querySelector("#inventory-balance-no-results");
    if(noResults)noResults.hidden=visible>0;
    const count=document.querySelector("#inventory-balance-search-count");
    if(count)count.textContent=query?`${visible} matching existing item${visible===1?"":"s"}`:`${rows.length} existing expendable item${rows.length===1?"":"s"}`;
  };
  document.querySelector("#inventory-balance-search")?.addEventListener("input",filterInventoryBalance);
  if(document.querySelector("#inventory-balance-search"))filterInventoryBalance();
  document.querySelectorAll("[data-stock-card]").forEach(button=>button.onclick=()=>{stockCardItemKey=button.dataset.stockCard;formTab="Appendix 58 (SC)";render("Forms")});
  document.querySelector("#stock-card-item-select")?.addEventListener("change",event=>{stockCardItemKey=event.target.value;rerenderReportSurface()});
  document.querySelector("#slc-item-select")?.addEventListener("change",event=>{suppliesLedgerItemKey=event.target.value;rerenderReportSurface()});
  document.querySelector("#property-card-select")?.addEventListener("change",event=>{propertyCardKey=event.target.value;rerenderReportSurface()});
  document.querySelector("#ppe-ledger-select")?.addEventListener("change",event=>{ppeLedgerKey=event.target.value;rerenderReportSurface()});
  document.querySelector("#par-property-select")?.addEventListener("change",event=>{parPropertyKey=event.target.value;rerenderReportSurface()});
  document.querySelector("#ics-property-select")?.addEventListener("change",event=>{icsPropertyKey=event.target.value;rerenderReportSurface()});
  document.querySelectorAll("[data-ptr-state]").forEach(control=>control.addEventListener("input",event=>{
    const field=event.target.dataset.ptrState;
    ptrState[field]=event.target.value;
    const display=document.querySelector(`#ptr-${field}-display`);
    if(display)display.textContent=event.target.value||"______________";
  }));
  document.querySelector('[data-ptr-state="type"]')?.addEventListener("change",rerenderReportSurface);
  document.querySelectorAll("[data-ptr-signatory]").forEach(control=>control.addEventListener("change",event=>{
    const id=`ptr-${event.target.dataset.ptrSignatory}`;
    const name=document.querySelector(`#${id}-name`);
    const position=document.querySelector(`#${id}-position`);
    if(name)name.textContent=event.target.value||"____________________";
    if(position)position.textContent=employeePosition(event.target.value)||"Designation";
  }));
  document.querySelectorAll("[data-ptr-property]").forEach(control=>control.addEventListener("change",event=>{
    const key=event.target.dataset.ptrProperty;
    ptrSelectedKeys=event.target.checked?[...new Set([...ptrSelectedKeys,key])]:ptrSelectedKeys.filter(value=>value!==key);
    rerenderReportSurface();
  }));
  document.querySelector("#sc-employee-select")?.addEventListener("change",event=>{
    const option=event.target.selectedOptions[0];
    const name=event.target.value;
    const position=option?.dataset.position||"";
    const printedName=document.querySelector("#sc-prepared-name");
    const printedPosition=document.querySelector("#sc-prepared-position");
    const positionDisplay=document.querySelector("#sc-selected-position");
    if(printedName)printedName.textContent=name||"____________________________";
    if(printedPosition)printedPosition.textContent=position||"Position";
    if(positionDisplay)positionDisplay.textContent=position||"Position will appear here";
  });
  document.querySelector("#slc-employee-select")?.addEventListener("change",event=>{
    const option=event.target.selectedOptions[0];
    const name=event.target.value;
    const position=option?.dataset.position||"";
    const printedName=document.querySelector("#slc-prepared-name");
    const printedPosition=document.querySelector("#slc-prepared-position");
    const positionDisplay=document.querySelector("#slc-selected-position");
    if(printedName)printedName.textContent=name||"____________________________";
    if(printedPosition)printedPosition.textContent=position||"Position";
    if(positionDisplay)positionDisplay.textContent=position||"Position will appear here";
  });
  const syncRsmiSignatory=(selectId,positionId)=>{
    const name=document.querySelector(selectId)?.value||"";
    const position=document.querySelector(positionId);
    if(position)position.textContent=rsmiEmployeePosition(name)||"Position will appear here";
  };
  document.querySelector("#rsmi-certified-by")?.addEventListener("change",()=>syncRsmiSignatory("#rsmi-certified-by","#rsmi-certified-position"));
  document.querySelector("#rsmi-posted-by")?.addEventListener("change",()=>syncRsmiSignatory("#rsmi-posted-by","#rsmi-posted-position"));
  ["#rsmi-classification","#rsmi-from","#rsmi-to"].forEach(selector=>document.querySelector(selector)?.addEventListener("change",updateRsmiTotal));
  const reportFrom=document.querySelector("#report-date-from");
  const reportTo=document.querySelector("#report-date-to");
  const syncReportDateRange=()=>{
    if(!reportFrom||!reportTo)return true;
    reportFrom.max=reportTo.value||"";
    reportTo.min=reportFrom.value||"";
    const valid=!reportFrom.value||!reportTo.value||reportFrom.value<=reportTo.value;
    reportFrom.setCustomValidity(valid?"":"Date from must be on or before Date to.");
    reportTo.setCustomValidity(valid?"":"Date to must be on or after Date from.");
    const feedback=document.querySelector("#report-date-feedback");
    if(feedback)feedback.textContent=valid?"":"Please select a valid inclusive date range.";
    return valid;
  };
  document.querySelectorAll("[data-report-filter]").forEach(control=>{
    const save=()=>{const activeReportKey=current==="Forms"?formTab:reportTab;const filter=reportDateFilters[activeReportKey]||(reportDateFilters[activeReportKey]={from:"",to:"",search:"",status:"All statuses"});filter[control.dataset.reportFilter]=control.value;syncReportDateRange()};
    control.addEventListener(control.type==="text"?"input":"change",save);
  });
  syncReportDateRange();
  document.querySelector("#apply-report-filters")?.addEventListener("click",()=>{
    if(!syncReportDateRange()){reportTo?.reportValidity();return}
    const feedback=document.querySelector("#report-date-feedback");
    if(feedback)feedback.textContent=reportFrom?.value||reportTo?.value?"Date range applied.":"Choose a Date from or Date to to filter this report.";
  });
  document.querySelector("#generate-rsmi")?.addEventListener("click",generateRsmi);
  document.querySelectorAll("[data-view-rsmi]").forEach(button=>button.onclick=()=>openRsmiView(+button.dataset.viewRsmi));
  document.querySelectorAll("[data-print-rsmi]").forEach(button=>button.onclick=()=>openRsmiView(+button.dataset.printRsmi,true));
  document.querySelectorAll("[data-export]").forEach(b=>b.onclick=()=>exportCurrentCsv(b.dataset.export));
  document.querySelectorAll("[data-print]").forEach(b=>b.onclick=()=>window.print());
  document.querySelectorAll(".generate").forEach(b=>b.onclick=()=>{b.textContent="✓ Prepared";b.style.color="var(--tenant-accent)"});
}

function nextRisNumber(dateValue=localISODate()){
  const date=new Date(`${dateValue}T00:00:00`);
  const year=Number.isNaN(date.getTime())?new Date().getFullYear():date.getFullYear();
  const month=String(Number.isNaN(date.getTime())?new Date().getMonth()+1:date.getMonth()+1).padStart(2,"0");
  const highest=risRecords.reduce((max,record)=>{
    const match=String(record.number||"").match(/^(\d{4})-(\d{2})-(\d{4,})$/);
    return match&&Number(match[1])===year?Math.max(max,Number(match[3])):max;
  },0);
  return `${year}-${month}-${String(highest+1).padStart(4,"0")}`;
}

function openRISForm(){
  const now=new Date();
  const today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  const next=nextRisNumber(today);
  document.querySelector("#modal").innerHTML=`<div class="modal-backdrop"><form class="drawer" id="ris-form" novalidate><input type="hidden" name="intent" id="ris-intent" value="draft"><div class="drawer-head"><div><p>Appendix 63 · New transaction</p><h2>Create Requisition and Issue Slip</h2></div><button type="button" id="close">×</button></div><div class="drawer-body"><p class="field-error" id="ris-error" role="alert" aria-live="assertive"></p><h3>RIS header</h3><div class="form-grid"><label>RIS number <span class="required-mark">*</span><input id="ris-number" name="number" value="${next}" pattern="[0-9]{4}-(0[1-9]|1[0-2])-[0-9]{4}" required><small class="field-hint">Automatically suggested in YYYY-MM-xxxx format. You may edit it before saving.</small></label><label>RIS date<input id="ris-date" name="date" type="date" value="${today}" required></label><label>Requesting office<select name="office" required><option value="">Select office</option></select></label><label>Requested by<select name="requested" required><option value="">Select employee</option></select></label><label class="wide">Purpose <span class="optional-mark">Optional</span><input name="purpose" placeholder="Purpose of the requested supplies"></label><label>Approved by<select name="approved"><option value="">Select employee</option></select></label><label>Issued by<select name="issued"><option value="">Select employee</option></select></label><label>Received by<select name="received"><option value="">Select employee</option></select></label><label class="wide">Remarks<textarea name="remarks" placeholder="Optional remarks"></textarea></label></div><div class="form-section-title"><h3>Expendable line item</h3></div><div class="source-card item-source"><span>EX</span><div><label>Expendable item<select id="ris-item" name="item" required><option value="" data-unit="" data-stock="0">Select item</option></select></label></div></div><div class="form-grid"><label>Unit<input id="ris-unit" readonly></label><label>Quantity issued<input name="issuedQty" id="ris-issued" type="number" min="0.001" step="0.001" required></label></div><div class="availability-card"><span>Current available balance</span><strong id="ris-available">No stock data</strong><small>Issued quantities will use the oldest batches first.</small></div></div><div class="drawer-foot"><button type="button" class="secondary-button" id="cancel">Cancel</button><button type="submit" class="secondary-button" id="save-ris-draft">Save RIS Draft</button><button type="submit" class="primary-button" id="approve-ris">Approved</button></div></form></div>`;
  const close=()=>document.querySelector("#modal").innerHTML="";document.querySelector("#close").onclick=close;document.querySelector("#cancel").onclick=close;
  const numberInput=document.querySelector("#ris-number");
  const dateInput=document.querySelector("#ris-date");
  let numberWasEdited=false;
  numberInput.addEventListener("input",()=>{numberWasEdited=true});
  dateInput.addEventListener("change",()=>{if(!numberWasEdited)numberInput.value=nextRisNumber(dateInput.value)});
  const setRisIntent=intent=>{document.querySelector("#ris-intent").value=intent};
  document.querySelector("#save-ris-draft").onclick=()=>setRisIntent("draft");
  document.querySelector("#approve-ris").onclick=()=>setRisIntent("approve");
  const item=document.querySelector("#ris-item");const sync=()=>{const o=item.selectedOptions[0];document.querySelector("#ris-unit").value=o.dataset.unit;document.querySelector("#ris-issued").max=o.dataset.stock;document.querySelector("#ris-available").textContent=`${o.dataset.stock} ${o.dataset.unit}${+o.dataset.stock===1?"":"s"}`};item.onchange=sync;
  document.querySelector("#ris-form").onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);const o=item.selectedOptions[0];const issued=+f.get("issuedQty");const intent=String(f.get("intent")||"draft");const number=String(f.get("number")||"").trim();if(!/^\d{4}-(0[1-9]|1[0-2])-\d{4}$/.test(number)){document.querySelector("#ris-error").textContent="RIS number must follow YYYY-MM-xxxx, for example 2026-08-0001.";return}if(issued<=0){document.querySelector("#ris-error").textContent="Quantity issued must be greater than zero.";return}if(intent==="approve"&&issued>+o.dataset.stock){document.querySelector("#ris-error").textContent="Approved quantity cannot exceed the available quantity.";return}if(risRecords.some(r=>r.number===number)){document.querySelector("#ris-error").textContent="RIS number already exists.";return}const rawDate=String(f.get("date"));const displayDate=new Date(`${rawDate}T00:00:00`).toLocaleDateString("en-PH",{month:"long",day:"numeric",year:"numeric"});const status=intent==="approve"?"Completed":"Draft";risRecords.unshift({number,date:displayDate,isoDate:rawDate,office:f.get("office"),purpose:f.get("purpose")||"",requestedBy:f.get("requested"),approvedBy:f.get("approved"),issuedBy:f.get("issued"),receivedBy:f.get("received"),remarks:f.get("remarks"),items:1,value:issued*+o.dataset.cost,status,inRsmi:false,lines:[{description:o.textContent,uom:o.dataset.unit,requestedQty:issued,issuedQty:issued,qty:issued,remarks:""}]});close();showToast(status==="Completed"?"RIS approved and posted to inventory.":"RIS draft saved. You can complete it later.");render("Requisition & Issue Slips")};
}
function viewRIS(index){
  printRIS(index);
}
function openRISEdit(index){
  const record=risRecords[index];
  if(!record||record.status!=="Draft"){showToast("Unpost the approved RIS before editing it.","error");return}
  openRISForm();
  const form=document.querySelector("#ris-form");
  if(!form)return;
  document.querySelector("#modal .drawer-head p").textContent="Appendix 63 · Draft transaction";
  document.querySelector("#modal .drawer-head h2").textContent=`Edit ${record.number}`;
  form.querySelector('[name="number"]').value=record.number;
  form.querySelector('[name="date"]').value=record.isoDate||"";
  form.querySelector('[name="office"]').value=record.office||"";
  form.querySelector('[name="requested"]').value=record.requestedBy||"";
  form.querySelector('[name="purpose"]').value=record.purpose||"";
  form.querySelector('[name="approved"]').value=record.approvedBy||"";
  form.querySelector('[name="issued"]').value=record.issuedBy||"";
  form.querySelector('[name="received"]').value=record.receivedBy||"";
  form.querySelector('[name="remarks"]').value=record.remarks||"";
  const line=record.lines?.[0]||{};
  const item=form.querySelector("#ris-item");
  item.value=line.description||"";
  item.dispatchEvent(new Event("change"));
  form.querySelector('[name="issuedQty"]').value=line.issuedQty??line.qty??"";
  document.querySelector("#approve-ris").hidden=true;
  const save=document.querySelector("#save-ris-draft");
  save.textContent="Save Changes";
  form.onsubmit=event=>{
    event.preventDefault();
    const data=new FormData(form);
    const selected=item.selectedOptions[0];
    const issued=Number(data.get("issuedQty"));
    const number=String(data.get("number")||"").trim();
    if(!/^\d{4}-(0[1-9]|1[0-2])-\d{4}$/.test(number)){document.querySelector("#ris-error").textContent="RIS number must follow YYYY-MM-xxxx.";return}
    if(risRecords.some((other,otherIndex)=>otherIndex!==index&&other.number===number)){document.querySelector("#ris-error").textContent="RIS number already exists.";return}
    if(!data.get("office")||!data.get("requested")||!data.get("item")||issued<=0){document.querySelector("#ris-error").textContent="Complete the office, requested by, item, and quantity fields.";return}
    const rawDate=String(data.get("date"));
    record.number=number;record.isoDate=rawDate;record.date=new Date(`${rawDate}T00:00:00`).toLocaleDateString("en-PH",{month:"long",day:"numeric",year:"numeric"});record.office=data.get("office");record.requestedBy=data.get("requested");record.purpose=data.get("purpose")||"";record.approvedBy=data.get("approved")||"";record.issuedBy=data.get("issued")||"";record.receivedBy=data.get("received")||"";record.remarks=data.get("remarks")||"";record.items=1;record.value=issued*Number(selected.dataset.cost||0);record.lines=[{...line,description:selected.textContent,uom:selected.dataset.unit,requestedQty:issued,issuedQty:issued,qty:issued}];
    document.querySelector("#modal").innerHTML="";showToast(`${record.number} updated.`);render("Requisition & Issue Slips");
  };
}

function risBatchOptionMarkup(selectedBatchId="",fallbackItemId=""){
  const batches=window.risAvailableBatches||[];
  const selected=selectedBatchId||batches.find(batch=>String(batch.itemId)===String(fallbackItemId))?.batchId||"";
  return `<option value="">Select an approved IAR item</option>${batches.map(batch=>`<option value="${escapeFormValue(batch.batchId)}" data-item-id="${escapeFormValue(batch.itemId)}" data-item-name="${escapeFormValue(batch.itemName)}" data-unit="${escapeFormValue(batch.uom)}" data-stock="${Number(batch.totalAvailable)||0}" data-batch-stock="${Number(batch.batchAvailable)||0}" data-cost="${Number(batch.unitCost)||0}" data-date="${escapeFormValue(batch.date)}" ${String(batch.batchId)===String(selected)?"selected":""}>${escapeFormValue(batch.label)}</option>`).join("")}`;
}

function risLineRow(line={},index=1){
  return `<tr data-ris-line-id="${escapeFormValue(line.dbId||"")}"><td><select class="ris-batch-item" name="batch" aria-label="Item Description line ${index}" required>${risBatchOptionMarkup(line.batchId,line.itemId)}</select><small class="ris-batch-balance">Select an approved IAR batch</small></td><td><input name="unit" aria-label="UOM line ${index}" value="${escapeFormValue(line.uom||"")}" readonly></td><td><input name="issuedQty" aria-label="QTY Issued line ${index}" type="number" min="0.001" step="0.001" value="${escapeFormValue(line.issuedQty??line.qty??"")}" required></td><td><div class="ris-remarks-action"><input name="lineRemarks" aria-label="Remarks line ${index}" value="${escapeFormValue(line.remarks||"")}" placeholder="Optional"><button type="button" class="remove-po-item remove-ris-item" aria-label="Delete RIS line ${index}" title="Delete line"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/></svg></button></div></td></tr>`;
}

function installRisLineEditor(form,initialLines=[{}]){
  const body=form.querySelector("#ris-item-rows");
  if(!body)return;
  const alreadyInstalled=body.dataset.editorInstalled==="true";
  const renderLines=lines=>{body.innerHTML=(lines.length?lines:[{}]).map((line,index)=>risLineRow(line,index+1)).join("");body.querySelectorAll("tr").forEach(syncRisLine)};
  const renumber=()=>body.querySelectorAll("tr").forEach((row,index)=>{
    row.querySelector('[name="batch"]')?.setAttribute("aria-label",`Item Description line ${index+1}`);
    row.querySelector('[name="unit"]')?.setAttribute("aria-label",`UOM line ${index+1}`);
    row.querySelector('[name="issuedQty"]')?.setAttribute("aria-label",`QTY Issued line ${index+1}`);
    row.querySelector('[name="lineRemarks"]')?.setAttribute("aria-label",`Remarks line ${index+1}`);
    const remove=row.querySelector(".remove-ris-item");if(remove)remove.setAttribute("aria-label",`Delete RIS line ${index+1}`);
  });
  function syncRisLine(row){
    const select=row.querySelector('[name="batch"]');
    const option=select?.selectedOptions[0];
    const unit=row.querySelector('[name="unit"]');
    const quantity=row.querySelector('[name="issuedQty"]');
    const balance=row.querySelector(".ris-batch-balance");
    if(unit)unit.value=option?.dataset.unit||"";
    if(quantity)quantity.max=option?.dataset.stock||"";
    if(balance)balance.textContent=option?.value?`FIFO available: ${option.dataset.stock} ${option.dataset.unit} · Selected batch: ${option.dataset.batchStock}`:"Select an approved IAR batch";
  }
  renderLines(initialLines);
  if(alreadyInstalled)return;
  body.dataset.editorInstalled="true";
  form.querySelector("#add-ris-item")?.addEventListener("click",()=>{body.insertAdjacentHTML("beforeend",risLineRow({},body.children.length+1));syncRisLine(body.lastElementChild);renumber()});
  body.addEventListener("change",event=>{if(event.target.matches('[name="batch"]'))syncRisLine(event.target.closest("tr"))});
  body.addEventListener("click",event=>{const remove=event.target.closest(".remove-ris-item");if(!remove)return;const row=remove.closest("tr");if(body.children.length===1){row.querySelectorAll("select,input:not([readonly])").forEach(field=>field.value="");syncRisLine(row)}else row.remove();renumber()});
}

function collectRisLineEntries(form,intent="draft"){
  const entries=[];
  const error=form.querySelector("#ris-error");
  form.querySelectorAll(".po-field-invalid").forEach(field=>field.classList.remove("po-field-invalid"));
  for(const [index,row] of [...form.querySelectorAll("#ris-item-rows tr")].entries()){
    const select=row.querySelector('[name="batch"]');
    const option=select?.selectedOptions[0];
    const quantityField=row.querySelector('[name="issuedQty"]');
    const quantity=Number(quantityField?.value);
    if(!option?.value||!option.dataset.itemId){select?.classList.add("po-field-invalid");if(error)error.textContent=`Line ${index+1}: select an existing expendable item from an approved IAR.`;select?.focus();return null}
    if(!Number.isFinite(quantity)||quantity<=0){quantityField?.classList.add("po-field-invalid");if(error)error.textContent=`Line ${index+1}: QTY Issued must be greater than zero.`;quantityField?.focus();return null}
    entries.push({dbId:row.dataset.risLineId||"",batchId:option.value,itemId:option.dataset.itemId,description:option.dataset.itemName,batchLabel:option.textContent,uom:option.dataset.unit,qty:quantity,issuedQty:quantity,requestedQty:quantity,remarks:String(row.querySelector('[name="lineRemarks"]')?.value||"").trim(),available:Number(option.dataset.stock||0),batchAvailable:Number(option.dataset.batchStock||0),unitCost:Number(option.dataset.cost||0),date:option.dataset.date||""});
  }
  if(intent==="approve"){
    const totals=new Map();
    for(const entry of entries)totals.set(entry.itemId,(totals.get(entry.itemId)||0)+entry.qty);
    for(const entry of entries)if(totals.get(entry.itemId)>entry.available){if(error)error.textContent=`${entry.description}: total QTY Issued exceeds the FIFO available balance of ${entry.available} ${entry.uom}.`;return null}
  }
  return entries;
}

function openRISFormMulti(){
  const now=new Date();
  const today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  const next=nextRisNumber(today);
  document.querySelector("#modal").innerHTML=`<div class="modal-backdrop"><form class="drawer po-drawer" id="ris-form" novalidate><input type="hidden" name="intent" id="ris-intent" value="draft"><div class="drawer-head"><div><p>Appendix 63 · New transaction</p><h2>Create Requisition and Issue Slip</h2></div><button type="button" id="close">×</button></div><div class="drawer-body"><p class="field-error" id="ris-error" role="alert" aria-live="assertive"></p><h3>RIS header</h3><div class="form-grid"><label>RIS number <span class="required-mark">*</span><input id="ris-number" name="number" value="${next}" pattern="[0-9]{4}-(0[1-9]|1[0-2])-[0-9]{4}" required><small class="field-hint">Automatically suggested in YYYY-MM-xxxx format. You may edit it before saving.</small></label><label>RIS date<input id="ris-date" name="date" type="date" value="${today}" required></label><label>Requesting office<select name="office" required><option value="">Select office</option></select></label><label>Requested by<select name="requested" required><option value="">Select employee</option></select></label><label class="wide">Purpose <span class="optional-mark">Optional</span><input name="purpose" placeholder="Purpose of the requested supplies"></label><label>Approved by<select name="approved"><option value="">Select employee</option></select></label><label>Issued by<select name="issued"><option value="">Select employee</option></select></label><label>Received by<select name="received"><option value="">Select employee</option></select></label><label class="wide">Remarks<textarea name="remarks" placeholder="Optional transaction remarks"></textarea></label></div><div class="po-items-heading"><div><h3>Items to issue</h3><p>Select approved IAR batches. Duplicate items are dated and ordered oldest-to-newest for FIFO.</p></div><button type="button" id="add-ris-item">＋ Add line</button></div><div class="po-item-table-wrap"><table class="po-item-editor ris-item-editor"><thead><tr><th>Item Description</th><th>UOM</th><th>QTY Issued</th><th>Remarks</th></tr></thead><tbody id="ris-item-rows"></tbody></table></div></div><div class="drawer-foot"><button type="button" class="secondary-button" id="cancel">Cancel</button><button type="submit" class="secondary-button" id="save-ris-draft">Save RIS Draft</button><button type="submit" class="primary-button" id="approve-ris">Approved</button></div></form></div>`;
  const form=document.querySelector("#ris-form");
  const close=()=>document.querySelector("#modal").innerHTML="";document.querySelector("#close").onclick=close;document.querySelector("#cancel").onclick=close;
  const numberInput=form.querySelector("#ris-number");let numberWasEdited=false;numberInput.addEventListener("input",()=>{numberWasEdited=true});form.querySelector("#ris-date").addEventListener("change",event=>{if(!numberWasEdited)numberInput.value=nextRisNumber(event.target.value)});
  form.querySelector("#save-ris-draft").onclick=()=>form.querySelector("#ris-intent").value="draft";form.querySelector("#approve-ris").onclick=()=>form.querySelector("#ris-intent").value="approve";
  installRisLineEditor(form,[{}]);
  form.onsubmit=event=>{event.preventDefault();const data=new FormData(form);const intent=String(data.get("intent")||"draft");const lines=collectRisLineEntries(form,intent);const number=String(data.get("number")||"").trim();if(!/^\d{4}-(0[1-9]|1[0-2])-\d{4}$/.test(number)){form.querySelector("#ris-error").textContent="RIS number must follow YYYY-MM-xxxx.";return}if(!lines)return;const rawDate=String(data.get("date"));const status=intent==="approve"?"Completed":"Draft";risRecords.unshift({number,date:new Date(`${rawDate}T00:00:00`).toLocaleDateString("en-PH",{month:"long",day:"numeric",year:"numeric"}),isoDate:rawDate,office:data.get("office"),purpose:data.get("purpose")||"",requestedBy:data.get("requested"),approvedBy:data.get("approved"),issuedBy:data.get("issued"),receivedBy:data.get("received"),remarks:data.get("remarks")||"",items:lines.length,value:lines.reduce((sum,line)=>sum+line.qty*line.unitCost,0),status,inRsmi:false,lines});close();showToast(status==="Completed"?"RIS approved and posted to inventory.":"RIS draft saved.");render("Requisition & Issue Slips")};
}

function openRISEditMulti(index){
  const record=risRecords[index];if(!record||record.status!=="Draft"){showToast("Unpost the approved RIS before editing it.","error");return}openRISForm();const form=document.querySelector("#ris-form");document.querySelector("#modal .drawer-head p").textContent="Appendix 63 · Draft transaction";document.querySelector("#modal .drawer-head h2").textContent=`Edit ${record.number}`;
  form.querySelector('[name="number"]').value=record.number;form.querySelector('[name="date"]').value=record.isoDate||"";form.querySelector('[name="office"]').value=record.office||"";form.querySelector('[name="requested"]').value=record.requestedBy||"";form.querySelector('[name="purpose"]').value=record.purpose||"";form.querySelector('[name="approved"]').value=record.approvedBy||"";form.querySelector('[name="issued"]').value=record.issuedBy||"";form.querySelector('[name="received"]').value=record.receivedBy||"";form.querySelector('[name="remarks"]').value=record.remarks||"";installRisLineEditor(form,record.lines||[{}]);form.querySelector("#approve-ris").hidden=true;const save=form.querySelector("#save-ris-draft");save.textContent="Save Changes";
  form.onsubmit=event=>{event.preventDefault();const data=new FormData(form);const lines=collectRisLineEntries(form,"draft");if(!lines)return;record.lines=lines;record.items=lines.length;record.value=lines.reduce((sum,line)=>sum+line.qty*line.unitCost,0);record.number=String(data.get("number")||"").trim();record.isoDate=String(data.get("date")||"");record.date=new Date(`${record.isoDate}T00:00:00`).toLocaleDateString("en-PH",{month:"long",day:"numeric",year:"numeric"});record.office=data.get("office");record.requestedBy=data.get("requested");record.purpose=data.get("purpose")||"";record.approvedBy=data.get("approved")||"";record.issuedBy=data.get("issued")||"";record.receivedBy=data.get("received")||"";record.remarks=data.get("remarks")||"";document.querySelector("#modal").innerHTML="";showToast(`${record.number} updated.`);render("Requisition & Issue Slips")};
}

openRISForm=openRISFormMulti;
openRISEdit=openRISEditMulti;

function unpostRIS(index){
  const record=risRecords[index];
  if(!record||record.status!=="Completed")return;
  if(record.inRsmi){showToast("Remove this RIS from its RSMI before unposting.","error");return}
  if(!confirm(`Unpost ${record.number}? Its inventory issue will be reversed and the RIS will return to Draft status.`))return;
  record.status="Draft";showToast(`${record.number} unposted. You can now edit or delete it.`);render("Requisition & Issue Slips");
}
function deleteRIS(index){
  const record=risRecords[index];
  if(!record||record.status!=="Draft"){showToast("Only a draft RIS can be deleted.","error");return}
  if(!confirm(`Delete draft ${record.number}?`))return;
  risRecords.splice(index,1);showToast(`${record.number} deleted.`);render("Requisition & Issue Slips");
}
function openCompleteRIS(index){
  const r=risRecords[index];
  const issuedValue=Number(r.value)||((r.lines||[]).reduce((sum,line)=>sum+(Number(line.totalCost)||Number(line.qty||line.issuedQty||0)*Number(line.unitCost||0)),0));
  document.querySelector("#modal").innerHTML=`<div class="modal-backdrop"><form class="drawer compact-drawer" id="complete-ris-form"><div class="drawer-head"><div><p>Important action</p><h2>Complete ${r.number}</h2></div><button type="button" id="close">×</button></div><div class="drawer-body"><div class="confirm-visual"><span>FIFO</span><h3>Deduct issued quantities and post the ledger?</h3><p>This will allocate the oldest available batches, preserve every cost layer, update balances, and make the RIS eligible for RSMI inclusion. It cannot be processed twice.</p></div><div class="summary-box"><div><span>Requesting office</span><strong>${r.office}</strong></div><div><span>Issued value</span><strong>${peso.format(issuedValue)}</strong></div></div><label class="full-label">Performed By<input name="performed" value="Supply Officer" required></label><label class="full-label">Completion remarks<textarea placeholder="Optional audit note"></textarea></label></div><div class="drawer-foot"><button type="button" class="secondary-button" id="cancel">Keep as draft</button><button class="primary-button">Complete and post FIFO</button></div></form></div>`;
  const close=()=>document.querySelector("#modal").innerHTML="";document.querySelector("#close").onclick=close;document.querySelector("#cancel").onclick=close;document.querySelector("#complete-ris-form").onsubmit=e=>{e.preventDefault();r.status="Completed";r.value=issuedValue;close();showToast(`${r.number} completed. FIFO deductions and stock movements were posted.`);render("Requisition & Issue Slips")};
}
function printRIS(index){
  const r=risRecords[index];
  const rows=(r.lines||[]).map(line=>`<tr><td>${line.stockNumber||""}</td><td>${line.uom||""}</td><td>${line.description||line.item||line.batchLabel||""}</td><td class="number-cell">${line.requestedQty??line.qty??""}</td><td class="check-cell">${Number(line.issuedQty??line.qty)>0?"✓":""}</td><td class="check-cell">${Number(line.issuedQty??line.qty)>0?"":"✓"}</td><td class="number-cell">${line.issuedQty??line.qty??""}</td><td>${line.remarks||""}</td></tr>`).join("");
  const blanks=Array.from({length:Math.max(0,16-(r.lines||[]).length)},()=>`<tr class="blank-ris-row"><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`).join("");
  const requestedPosition=r.requestedPosition||masters.Employees.find(employee=>employee[1]===r.requestedBy)?.[2]||"";
  const employeePosition=name=>masters.Employees.find(employee=>employee[1]===name)?.[2]||"";
  const signatureColumn=(title,name,designation="")=>`<div><strong>${title}</strong><span class="signature-line"></span><span class="ris-signature-name">${name||"________________________"}</span><small>Printed Name</small><span>${designation||employeePosition(name)||"________________________"}</span><small>Designation</small><span>${r.date||"________________________"}</span><small>Date</small></div>`;
  document.querySelector("#modal").innerHTML=`<div class="modal-backdrop print-preview"><div class="government-form ris-official-form"><div class="print-actions"><button class="secondary-button" id="close">Close</button><button class="primary-button" id="print-now">Print Appendix 63</button></div><div class="ris-appendix-label">Appendix 63</div><img class="ris-header-image" src="/agency-header-placeholder.png" alt="Your Agency official header"><h1>REQUISITION AND ISSUE SLIP</h1><div class="ris-entity-row"><p>Entity Name: <strong>${window.stockCardEntityName||"Your Agency"}</strong></p><p>Fund Cluster: <strong>Regular Fund 01</strong></p></div><div class="ris-document-row"><p>Division: <strong>${r.office||""}</strong></p><p>Responsibility Center Code: <strong>________________________</strong></p><p>Office: <strong>${r.office||""}</strong></p><p>RIS No.: <strong>${r.number}</strong></p></div><table class="ris-appendix-table"><colgroup><col class="ris-stock-number-column"><col class="ris-unit-column"><col class="ris-description-column"><col class="ris-requisition-quantity-column"><col class="ris-available-column"><col class="ris-available-column"><col class="ris-issue-quantity-column"><col class="ris-remarks-column"></colgroup><thead><tr><th colspan="4">Requisition</th><th colspan="2">Stock Available?</th><th colspan="2">Issue</th></tr><tr><th>Stock No.</th><th>Unit</th><th>Description</th><th>Quantity</th><th>Yes</th><th>No</th><th>Quantity</th><th>Remarks</th></tr></thead><tbody>${rows}${blanks}</tbody></table><p class="ris-purpose"><strong>Purpose:</strong> ${r.purpose||""}</p><div class="ris-signatures">${signatureColumn("Requested by:",r.requestedBy,requestedPosition)}${signatureColumn("Approved by:",r.approvedBy)}${signatureColumn("Issued by:",r.issuedBy,"Supply Officer")}${signatureColumn("Received by:",r.receivedBy)}</div></div></div>`;
  document.querySelector("#close").onclick=()=>document.querySelector("#modal").innerHTML="";document.querySelector("#print-now").onclick=()=>window.print();
}
function openPropertyForm(index){
  const p=propertyUnits[index];
  if(p.classification==="Semi-Expendable")return openSemiPropertyForm(index);
  const suggestedPar=p.parNumber||nextParNumber();
  document.querySelector("#modal").innerHTML=`<div class="modal-backdrop"><form class="drawer" id="property-form">
    <div class="drawer-head"><div><p>${p.classification}</p><h2>Edit property unit</h2></div><button type="button" id="close">×</button></div>
    <div class="drawer-body"><div class="source-card"><span>PR</span><div><strong>${p.item}</strong><p>${p.po} · ${p.iar} · ${peso.format(p.cost)}</p></div>${badge(p.status)}</div>
    <div class="form-grid"><label>PAR No.<input name="parNumber" value="${escapeFormValue(suggestedPar)}" pattern="[0-9]{4}-([0-9]{4}|[0-9]{3}[A-Za-z])" required><small class="field-hint">Pre-populated and editable. Accepts YYYY-0001 or a letter suffix such as YYYY-001A.</small></label><label>Brand<input name="brand" value="${escapeFormValue(p.brand)}"></label><label>Model<input name="model" value="${escapeFormValue(p.model)}"></label><label>Serial number<input name="serial" value="${escapeFormValue(p.serial)}" placeholder="May be assigned later"></label>
    <label>Property number<input name="number" value="${escapeFormValue(p.number)}" readonly><small class="field-hint">Assigned automatically when the IAR is approved. It cannot be edited here.</small></label>
    <label>Current status<select name="status">${["Available","Issued","Under Repair","Returned","Unserviceable","Transferred","Disposed"].map(value=>`<option ${value===p.status?"selected":""}>${value}</option>`).join("")}</select></label>
    <label>Condition<select name="condition">${["Serviceable","Unserviceable","Repair"].map(value=>`<option ${value===normalizedPropertyCondition(p.condition)?"selected":""}>${value}</option>`).join("")}</select></label>
    <label>Received From<select name="receivedFrom"><option value="">Select employee</option>${propertyEmployeeOptions(p.issuedBy)}</select></label>
    <label>Received By<select name="employee"><option value="">Unassigned</option>${propertyEmployeeOptions(p.employee)}</select></label>
    <label class="wide">Other Information<textarea name="otherInfo" placeholder="Specifications or other property information">${escapeFormValue(String(p.otherInfo||p.remarks||"").replace(/\s*\[PAR No\.:\s*[^\]]+\]\s*/ig," ").trim())}</textarea></label></div>
    <p class="field-error" id="property-error"></p></div>
    <div class="drawer-foot"><button type="button" class="secondary-button" id="cancel">Cancel</button><button type="submit" class="primary-button">Save property record</button></div></form></div>`;
  const close=()=>document.querySelector("#modal").innerHTML="";
  document.querySelector("#close").onclick=close;
  document.querySelector("#cancel").onclick=close;
  document.querySelector("#property-form").onsubmit=event=>{
    event.preventDefault();
    const form=new FormData(event.target);
    p.parNumber=String(form.get("parNumber")||"").trim().toUpperCase();p.brand=form.get("brand");p.model=form.get("model");p.serial=form.get("serial");p.status=form.get("status");p.condition=form.get("condition");p.employee=form.get("employee");p.issuedBy=form.get("receivedFrom");p.otherInfo=form.get("otherInfo");
    const employee=masters.Employees.find(value=>value[1]===p.employee);p.position=employee?employee[2]:"";
    p.issuedByPosition=employeePosition(p.issuedBy);
    close();showToast("Property record updated and audit entry prepared.");render("Property Records");
  };
}

function openSemiPropertyForm(index){
  const p=propertyUnits[index];
  const now=new Date();
  const year=now.getFullYear();
  const month=String(now.getMonth()+1).padStart(2,"0");
  const nextSequence=Math.max(0,...propertyUnits.filter(unit=>Number(unit.icsYear)===year).map(unit=>Number(unit.icsSequence)||0))+1;
  const suggestedIcs=p.icsNumber||`${year}-${month}-${String(nextSequence).padStart(4,"0")}`;
  document.querySelector("#modal").innerHTML=`<div class="modal-backdrop"><form class="drawer" id="property-form">
    <div class="drawer-head"><div><p>Semi-Expendable · Appendix 59</p><h2>${p.icsNumber?"Edit":"Issue"} property unit</h2></div><button type="button" id="close">×</button></div>
    <div class="drawer-body"><div class="source-card"><span>ICS</span><div><strong>${escapeFormValue(p.item)}</strong><p>${escapeFormValue(p.po)} · ${escapeFormValue(p.iar)} · ${peso.format(p.cost)}</p></div>${badge(p.status)}</div>
    <div class="form-grid"><label>ICS No.<input name="icsNumber" value="${escapeFormValue(suggestedIcs)}" pattern="[0-9]{4}-[0-9]{2}-([0-9]{4}|[0-9]{3}[A-Za-z])" required><small class="field-hint">Editable. Accepts 2026-05-0001 or a letter suffix such as 2026-05-001A.</small></label><label>Inventory Item No.<input name="inventoryNumber" value="${escapeFormValue(p.inventoryNumber||"")}" placeholder="Auto-assigned when blank" pattern="[0-9]{4}-[0-9]{2}-([0-9]{4}|[0-9]{3}[A-Za-z])"><small class="field-hint">Editable. Accepts 5030-05-0001 or 5030-05-001A. Leave blank for automatic numbering.</small></label>
    <label>PPE No.<input name="ppeNumber" value="${escapeFormValue(p.number||"")}" pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}-([0-9]{4}|[0-9]{3}[A-Za-z])" required><small class="field-hint">Pre-populated and editable. Accepts YYYY-XX-XX-0001 or a letter suffix such as YYYY-XX-XX-001A.</small></label>
    <label>Brand<input name="brand" value="${escapeFormValue(p.brand)}"></label><label>Model<input name="model" value="${escapeFormValue(p.model)}"></label><label>Serial number<input name="serial" value="${escapeFormValue(p.serial)}" placeholder="May be assigned later"></label><label>Condition<select name="condition">${["Serviceable","Unserviceable","Repair"].map(value=>`<option ${value===normalizedPropertyCondition(p.condition)?"selected":""}>${value}</option>`).join("")}</select></label>
    <label>Issued to / Received by<select name="employee" required><option value="">Select employee</option>${propertyEmployeeOptions(p.employee)}</select></label><label>Issued by<select name="issuedBy" required><option value="">Select employee</option>${propertyEmployeeOptions(p.issuedBy)}</select></label>
    <label class="wide">Other Info<textarea name="otherInfo" placeholder="Specifications or other accountability details">${escapeFormValue(p.otherInfo||"")}</textarea></label></div>
    <p class="field-error" id="property-error"></p></div>
    <div class="drawer-foot"><button type="button" class="secondary-button" id="cancel">Cancel</button><button type="submit" class="secondary-button" name="intent" value="save">Save changes</button><button type="submit" class="primary-button" name="intent" value="generate">${p.icsNumber?"Update ICS":"Generate ICS"}</button></div></form></div>`;
  const close=()=>document.querySelector("#modal").innerHTML="";
  document.querySelector("#close").onclick=close;document.querySelector("#cancel").onclick=close;
  document.querySelector("#property-form").onsubmit=event=>{event.preventDefault();const form=new FormData(event.currentTarget);const generate=event.submitter?.value==="generate";p.number=String(form.get("ppeNumber")||"").trim().toUpperCase();p.brand=form.get("brand");p.model=form.get("model");p.serial=form.get("serial");p.condition=form.get("condition");p.employee=form.get("employee");p.issuedBy=form.get("issuedBy");p.otherInfo=form.get("otherInfo");p.inventoryNumber=String(form.get("inventoryNumber")||"").trim().toUpperCase();p.status="Issued";p.position=employeePosition(p.employee);p.issuedByPosition=employeePosition(p.issuedBy);if(generate)p.icsNumber=String(form.get("icsNumber")||"").trim().toUpperCase();close();showToast(generate?"ICS generated.":"Changes saved without consuming an ICS sequence.");render("Property Records")};
}
function openMasterForm(tab,index=null){
  if(tab==="System Settings"){document.querySelector("#save-setting")?.scrollIntoView({behavior:"smooth"});return}
  const existing=index===null?null:masters[tab]?.[index];
  if(tab==="Suppliers"){
    document.querySelector("#modal").innerHTML=`<div class="modal-backdrop"><form class="drawer compact-drawer" id="master-form"><div class="drawer-head"><div><p>Supplier master data</p><h2>${existing?"Edit":"Add"} Supplier</h2></div><button type="button" id="close">×</button></div><div class="drawer-body"><div class="form-grid"><label class="wide">Supplier name<input name="name" value="${existing?.[0]||""}" required></label><label class="wide">Complete address<textarea name="address" required>${existing?.[1]||""}</textarea><small class="field-hint">This is the address automatically displayed in new purchase orders.</small></label><label>Contact person<input name="contactPerson" value="${existing?.[2]||""}"></label><label>Contact no.<input name="contactNumber" value="${existing?.[3]||""}"></label><label>TIN<input name="tin" value="${existing?.[4]||""}"></label><label>Status<select name="status"><option ${existing?.[5]!=="Inactive"?"selected":""}>Active</option><option ${existing?.[5]==="Inactive"?"selected":""}>Inactive</option></select></label></div></div><div class="drawer-foot"><button type="button" class="secondary-button" id="cancel">Cancel</button><button class="primary-button">Save supplier</button></div></form></div>`;
    const close=()=>document.querySelector("#modal").innerHTML="";
    document.querySelector("#close").onclick=close;
    document.querySelector("#cancel").onclick=close;
    document.querySelector("#master-form").onsubmit=e=>{
      e.preventDefault();
      const form=new FormData(e.target);
      const record=[form.get("name").trim(),form.get("address").trim(),form.get("contactPerson").trim(),form.get("contactNumber").trim(),form.get("tin").trim(),form.get("status")];
      if(index===null)masters.Suppliers.push(record);else masters.Suppliers[index]=record;
      close();
      showToast(`Supplier master record ${existing?"updated":"saved"}.`);
      render("Admin Options");
    };
    return;
  }
  document.querySelector("#modal").innerHTML=`<div class="modal-backdrop"><form class="drawer compact-drawer" id="master-form"><div class="drawer-head"><div><p>Master data</p><h2>Add ${tab.slice(0,-1)}</h2></div><button type="button" id="close">×</button></div><div class="drawer-body"><div class="form-grid"><label>Code or identifier<input name="code" required></label><label>Name or title<input name="name" required></label><label class="wide">Description / address<textarea></textarea></label><label>Status<select><option>Active</option><option>Inactive</option></select></label><label>Remarks<input></label></div><div class="notice-note">Additional fields remain available in the full master-data form and Supabase schema.</div></div><div class="drawer-foot"><button type="button" class="secondary-button" id="cancel">Cancel</button><button class="primary-button">Save master record</button></div></form></div>`;
  const close=()=>document.querySelector("#modal").innerHTML="";document.querySelector("#close").onclick=close;document.querySelector("#cancel").onclick=close;document.querySelector("#master-form").onsubmit=e=>{e.preventDefault();close();showToast(`${tab.slice(0,-1)} master record saved.`)};
}
function updateRsmiTotal(){
  const classification=document.querySelector("#rsmi-classification")?.value||"";
  const from=document.querySelector("#rsmi-from")?.value||"";
  const to=document.querySelector("#rsmi-to")?.value||"";
  const valid=Boolean(classification&&from&&to&&from<=to);
  const matches=valid?rsmiMatchingRecords(classification,from,to):[];
  const total=matches.reduce((sum,record)=>sum+rsmiCategoryValue(record,classification),0);
  const list=document.querySelector("#rsmi-auto-list");if(list)list.innerHTML=rsmiPreviewMarkup(classification,from,to);
  const count=document.querySelector("#rsmi-match-count");if(count)count.textContent=`${matches.length} matched`;
  const totalDisplay=document.querySelector("#rsmi-total");if(totalDisplay)totalDisplay.textContent=peso.format(total);
  const number=document.querySelector("#rsmi-number");if(number&&from)number.value=nextRsmiNumber(from);
  const button=document.querySelector("#generate-rsmi");if(button)button.disabled=!valid||!matches.length;
}

function rsmiDisplayDate(value){
  if(!value)return "________________";
  const parsed=new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())?escapeFormValue(value):parsed.toLocaleDateString("en-PH",{month:"long",day:"numeric",year:"numeric"});
}

function openRsmiView(index,printNow=false){
  const report=rsmiRecords[index];
  if(!report)return;
  const linked=risRecords
    .filter(record=>(report.ris||[]).includes(record.number))
    .sort((a,b)=>String(a.isoDate||a.date||"").localeCompare(String(b.isoDate||b.date||"")));
  const rows=linked.flatMap(record=>(record.lines||[])
    .filter(line=>!report.classification||risLineCategory(line)===report.classification)
    .map(line=>{
      const item=masters.Items.find(row=>String(row[0])===String(line.stockNumber||"")||row[1]===line.description||row[1]===line.generalName);
      const quantity=Number(line.qty||line.issuedQty||0);
      const unitCost=Number(line.unitCost||0);
      const amount=Number(line.totalCost||quantity*unitCost);
      return {ris:record.number,office:record.office||"",stock:line.stockNumber||item?.[0]||"",item:line.description||line.generalName||item?.[1]||"",unit:line.uom||line.unit||item?.[3]||"",quantity,unitCost,amount,uacs:line.uacsCode||item?.[4]||""};
    }));
  const bodyRows=rows.map(row=>`<tr><td>${escapeFormValue(row.ris)}</td><td>${escapeFormValue(row.office)}</td><td>${escapeFormValue(row.stock)}</td><td>${escapeFormValue(row.item)}</td><td>${escapeFormValue(row.unit)}</td><td class="number">${row.quantity.toLocaleString("en-PH")}</td><td class="number">${row.unitCost.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</td><td class="number">${row.amount.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</td></tr>`).join("");
  const blankRows=Array.from({length:Math.max(0,15-rows.length)},()=>`<tr class="blank"><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`).join("");
  const recapRows=rows.map(row=>`<tr><td>${escapeFormValue(row.stock)}</td><td class="number">${row.quantity.toLocaleString("en-PH")}</td><td class="recap-gap"></td><td class="number">${row.unitCost.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</td><td class="number">${row.amount.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</td><td>${escapeFormValue(row.uacs)}</td></tr>`).join("");
  const total=rows.reduce((sum,row)=>sum+row.amount,0);
  document.querySelector("#modal").innerHTML=`<div class="modal-backdrop rsmi-modal"><div class="view-modal rsmi-view-modal"><div class="modal-actions print-actions"><button class="secondary-button" id="close-rsmi-view">Close</button><button class="primary-button" id="print-rsmi-view">Print</button></div><section class="government-form rsmi-official-form"><div class="appendix-label">Appendix 64</div><img class="rsmi-official-header" src="/agency-header-placeholder.png" alt="Your Agency header"><h1>REPORT OF SUPPLIES AND MATERIALS ISSUED</h1><div class="rsmi-form-meta"><div><b>Entity Name:</b> ${escapeFormValue(window.stockCardEntityName||"Your Agency")}</div><div><b>Serial No.:</b> ${escapeFormValue(report.number)}</div><div><b>Fund Cluster:</b> Regular 01</div><div><b>Date:</b> ${escapeFormValue(report.prepared||"")}</div></div><table class="rsmi-official-table"><colgroup><col class="ris-no"><col class="responsibility"><col class="stock"><col class="item"><col class="unit"><col class="quantity"><col class="unit-cost"><col class="amount"></colgroup><thead><tr><th colspan="6">To be filled up by the Supply and/or Property Division/Unit</th><th colspan="2">To be filled up by the Accounting Division/Unit</th></tr><tr><th>RIS No.</th><th>Responsibility Center Code</th><th>Stock No.</th><th>Item</th><th>Unit</th><th>Quantity Issued</th><th>Unit Cost</th><th>Amount</th></tr></thead><tbody>${bodyRows}${blankRows}<tr class="total-row"><td colspan="7">TOTAL</td><td class="number">${total.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</td></tr></tbody></table><div class="rsmi-recap-title">RECAPITULATION</div><table class="rsmi-recap-table"><colgroup><col><col><col class="recap-gap"><col><col><col></colgroup><thead><tr><th>Stock No.</th><th>Quantity</th><th class="recap-gap"></th><th>Unit Cost</th><th>Total Cost</th><th>UACS Object Code</th></tr></thead><tbody>${recapRows||`<tr><td>&nbsp;</td><td></td><td class="recap-gap"></td><td></td><td></td><td></td></tr>`}</tbody></table><div class="rsmi-certification"><section><p>I hereby certify to the correctness of the above information.</p><div class="signature-space"></div><strong>${escapeFormValue(report.certifiedBy||"____________________________")}</strong><span>Signature over Printed Name of Supply and/or Property Custodian</span><em>${escapeFormValue(report.certifiedPosition||"")}</em><span>Date: ${rsmiDisplayDate(report.certifiedDate)}</span></section><section><p>Posted by:</p><div class="signature-space"></div><strong>${escapeFormValue(report.postedBy||"____________________________")}</strong><span>Signature over Printed Name of Designated Accounting Staff</span><em>${escapeFormValue(report.postedPosition||"")}</em><span>Date: ${rsmiDisplayDate(report.postedDate)}</span></section></div></section></div></div>`;
  const close=()=>{document.querySelector("#modal").innerHTML=""};
  document.querySelector("#close-rsmi-view").onclick=close;
  document.querySelector("#print-rsmi-view").onclick=()=>window.print();
  if(printNow)setTimeout(()=>window.print(),50);
}

function generateRsmi(){
  const classification=document.querySelector("#rsmi-classification")?.value||"";
  const from=document.querySelector("#rsmi-from")?.value||"";
  const to=document.querySelector("#rsmi-to")?.value||"";
  const number=document.querySelector("#rsmi-number")?.value.trim()||"";
  const certifiedBy=document.querySelector("#rsmi-certified-by")?.value||"";
  const certifiedDate=document.querySelector("#rsmi-certified-date")?.value||"";
  const postedBy=document.querySelector("#rsmi-posted-by")?.value||"";
  const postedDate=document.querySelector("#rsmi-posted-date")?.value||"";
  if(!classification){showToast("Select an RSMI classification.","error");return}
  if(!from||!to||from>to){showToast("Enter a valid From and To date range.","error");return}
  if(!/^\d{4}-\d{3}$/.test(number)){showToast("RSMI number must follow YYYY-XXX.","error");return}
  if(!certifiedBy||!postedBy){showToast("Select both RSMI signatories.","error");return}
  if(!certifiedDate||!postedDate){showToast("Enter both signatory dates manually.","error");return}
  if(rsmiRecords.some(record=>record.number===number)){showToast("RSMI number already exists.","error");return}
  const matches=rsmiMatchingRecords(classification,from,to);
  if(!matches.length){showToast("No completed RIS matches the selected classification and date range.","error");return}
  if(!confirm(`Finalize ${number} for ${classification} with ${matches.length} automatically selected RIS record${matches.length===1?"":"s"}?`))return;
  const total=matches.reduce((sum,record)=>sum+rsmiCategoryValue(record,classification),0);
  matches.forEach(record=>{record.inRsmi=true});
  const preparedDate=new Date().toLocaleDateString("en-PH",{month:"long",day:"numeric",year:"numeric"});
  const period=`${new Date(`${from}T00:00:00`).toLocaleDateString("en-PH",{month:"long",day:"numeric",year:"numeric"})} – ${new Date(`${to}T00:00:00`).toLocaleDateString("en-PH",{month:"long",day:"numeric",year:"numeric"})}`;
  rsmiRecords.unshift({number,classification,from,to,period,prepared:preparedDate,ris:matches.map(record=>record.number),value:total,status:"Finalized",certifiedBy,certifiedPosition:rsmiEmployeePosition(certifiedBy),certifiedDate,postedBy,postedPosition:rsmiEmployeePosition(postedBy),postedDate});
  showToast(`${number} finalized with ${matches.length} automatically selected RIS record${matches.length===1?"":"s"}.`);render("RSMI Generation");
}
function exportCurrentCsv(kind){
  let rows=[["Report","Generated","Status"],[kind,new Date().toLocaleDateString("en-PH"),"Prepared"]];
  if(kind==="ris")rows=[["RIS Number","Date","Requesting Office","Requested By","Purpose","Items","Issued Value","Status","RSMI"],...risRecords.map(r=>[r.number,r.date,r.office,r.requestedBy,r.purpose,r.items,r.value,r.status,r.inRsmi?"Included":"Not included"])];
  if(kind==="property"||kind==="report")rows=[["Property Number","PAR Number","Classification","Item","Brand","Model","Serial Number","Acquisition Cost","PO","IAR","Employee","Office","Location","Condition","Status"],...propertyUnits.map(p=>[p.number,p.parNumber,p.classification,p.item,p.brand,p.model,p.serial,p.cost,p.po,p.iar,p.employee,p.office,p.location,p.condition,p.status])];
  if(kind==="rsmi")rows=[["RSMI Number","Reporting Period","Date Prepared","Included RIS","Total Issued Cost","Status"],...rsmiRecords.map(r=>[r.number,r.period,r.prepared,r.ris.join("; "),r.value,r.status])];
  const csv=rows.map(r=>r.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\n");const url=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));const a=document.createElement("a");a.href=url;a.download=`${kind}-report-july-2026.csv`;a.click();URL.revokeObjectURL(url);showToast("CSV export prepared.");
}
function showToast(message,type="success"){
  let container=document.querySelector("#toast-container");if(!container){container=document.createElement("div");container.id="toast-container";document.body.appendChild(container)}const toast=document.createElement("div");toast.className=`toast ${type}`;toast.innerHTML=`<b>${type==="error"?"!":"✓"}</b><span>${message}</span>`;container.appendChild(toast);setTimeout(()=>toast.remove(),3500);
}
document.querySelectorAll(".sidebar nav button").forEach(b=>b.onclick=()=>{if(b.dataset.view==="Property Records")propertyRecordsMode="";render(b.dataset.view)});
document.querySelector("#menu").onclick=()=>document.querySelector("#sidebar").classList.add("open");
document.querySelector("#scrim").onclick=()=>document.querySelector("#sidebar").classList.remove("open");
const datePickerObserver=new MutationObserver(mutations=>{
  mutations.forEach(mutation=>mutation.addedNodes.forEach(node=>{
    if(node.nodeType===Node.ELEMENT_NODE)prepareDatePickers(node);
  }));
});
datePickerObserver.observe(document.body,{childList:true,subtree:true});
document.addEventListener("click",event=>{
  const input=event.target.closest?.('input[type="date"]');
  if(!input||input.disabled||input.readOnly||!input.showPicker)return;
  try{input.showPicker()}catch{}
});
document.addEventListener("keydown",event=>{
  const input=event.target.closest?.('input[type="date"]');
  if(!input||input.disabled||input.readOnly||!input.showPicker)return;
  if(event.key==="ArrowDown"&&event.altKey){event.preventDefault();try{input.showPicker()}catch{}}
});
prepareDatePickers(document);
render("Dashboard");
