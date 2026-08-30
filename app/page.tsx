"use client";

import { CSSProperties, FormEvent, useEffect, useMemo, useState } from "react";
import { dateLabel, DmwTransferData, numberValue, rowsById, textValue, TransferRow } from "@/lib/dmwTransfer";

type Module = "Dashboard" | "Purchase Orders" | "Inspection and Acceptance Reports" | "Requisition and Issue Slips" | "Property Records" | "Admin Options" | "Forms" | "Reports";
type POStatus = "Draft" | "Completed" | "Cancelled";
type IARStatus = "Draft" | "Partially Inspected" | "Completed" | "Cancelled" | "Rejected";
type Classification = "Expendable" | "Semi-Expendable" | "Capital Outlay";

type PurchaseOrder = {
  id: string | number;
  number: string;
  date: string;
  supplier: string;
  pr: string;
  mode: string;
  fund: string;
  status: POStatus;
  item: string;
  category: string;
  quantity: number;
  unit: string;
  unitCost: number;
  total?: number;
  lineCount?: number;
};

type IAR = {
  id: string | number;
  number: string;
  poNumber: string;
  supplier: string;
  date: string;
  delivered: number;
  accepted: number;
  rejected: number;
  status: IARStatus;
  item: string;
  classification?: Classification;
};

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("en-PH");
const tell = (message: string) => window.alert(message);
const downloadCsv = (filename: string, headers: string[], rows: (string | number)[][]) => {
  const escape = (value: string | number) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const content = [headers, ...rows].map(row => row.map(escape).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
};

const seedPOs: PurchaseOrder[] = [];

const seedIARs: IAR[] = [];

const supplierOptions = [
  { name: "Metro Office Solutions, Inc.", address: "Quezon City" },
  { name: "Luzon Technology Trading", address: "Makati City" },
  { name: "Papertrail Supplies Corp.", address: "Manila" },
];

const procurementModes = [
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
];

const nav: { name: Module; short: string }[] = [
  { name: "Dashboard", short: "⌂" },
  { name: "Purchase Orders", short: "PO" },
  { name: "Inspection and Acceptance Reports", short: "IA" },
  { name: "Property Records", short: "PR" },
  { name: "Admin Options", short: "AD" },
  { name: "Forms", short: "FM" },
  { name: "Reports", short: "RP" },
];

function Badge({ value }: { value: string }) {
  const tone = value === "Completed" || value === "Active" ? "green" : value === "Draft" ? "gray" : value.includes("Partial") || value === "Low stock" ? "amber" : value === "Cancelled" || value === "Rejected" ? "red" : "blue";
  return <span className={`badge badge-${tone}`}><i />{value}</span>;
}

function Topbar({ title, onMenu }: { title: string; onMenu: () => void }) {
  return (
    <header className="topbar">
      <div className="topbar-title">
        <button className="mobile-menu" aria-label="Open navigation" onClick={onMenu}>☰</button>
        <div>
          <p>Inventory and Property Management</p>
          <h1>{title}</h1>
        </div>
      </div>
      <div className="topbar-actions">
        <button className="icon-button" aria-label="Notifications" onClick={()=>tell("You have no unread notifications.")}>♢<span /></button>
        <div className="profile-mark">GS</div>
        <div className="profile-copy"><strong>General Services Unit</strong><small>Supply & Property</small></div>
      </div>
    </header>
  );
}

function Metric({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <article className="metric-card">
      <span className={`metric-icon ${accent}`}>{label.split(" ").map(word => word[0]).slice(0, 2).join("")}</span>
      <div><p>{label}</p><strong>{value}</strong><small>{sub}</small></div>
    </article>
  );
}

function Dashboard({ pos, iars, setModule }: { pos: PurchaseOrder[]; iars: IAR[]; setModule: (m: Module) => void }) {
  const monthBars = [43, 56, 47, 71, 61, 85, 68, 92, 77, 88, 70, 82];
  return (
    <>
      <section className="welcome-row">
        <div><h2>Good morning, Supply Officer</h2><p>Here’s the current status of your inventory and property records.</p></div>
        <div className="period-chip">Reporting period <strong>July 2026</strong></div>
      </section>
      <section className="metrics-grid">
        <Metric label="Active Purchase Orders" value={String(pos.filter(po=>po.status!=="Cancelled").length)} sub="Current records" accent="blue" />
        <Metric label="Completed POs" value={String(pos.filter(po=>po.status==="Completed").length)} sub="Current records" accent="green" />
        <Metric label="Pending IARs" value={String(iars.filter(iar=>iar.status!=="Completed").length)} sub="Current records" accent="amber" />
        <Metric label="Completed IARs" value={String(iars.filter(iar=>iar.status==="Completed").length)} sub="Current records" accent="teal" />
        <Metric label="Expendable Inventory" value="4,286" sub={peso.format(864320)} accent="indigo" />
        <Metric label="Semi-Expendable Units" value="314" sub={peso.format(2849150)} accent="violet" />
        <Metric label="Capital Outlay Units" value="126" sub={peso.format(18756800)} accent="navy" />
        <Metric label="Items Issued" value="387" sub="Current month" accent="sky" />
      </section>
      <section className="dashboard-grid">
        <article className="panel span-2">
          <div className="panel-heading"><div><h3>Monthly inventory issuance</h3><p>Issued quantities for the last 12 months</p></div><select aria-label="Chart year"><option>2026</option></select></div>
          <div className="chart">
            <div className="chart-y"><span>600</span><span>400</span><span>200</span><span>0</span></div>
            <div className="bars">{monthBars.map((height, index) => <div className="bar-wrap" key={index}><div className="bar" style={{ height: `${height}%` }}><b>{index === 7 ? "542" : ""}</b></div><span>{["Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar","Apr","May","Jun","Jul"][index]}</span></div>)}</div>
          </div>
        </article>
        <article className="panel">
          <div className="panel-heading"><div><h3>Inventory composition</h3><p>By current asset value</p></div></div>
          <div className="donut-row"><div className="donut"><span><strong>₱22.5M</strong><small>Total value</small></span></div><div className="legend"><p><i className="l1"/>Capital Outlay <b>83.5%</b></p><p><i className="l2"/>Semi-Expendable <b>12.7%</b></p><p><i className="l3"/>Expendable <b>3.8%</b></p></div></div>
        </article>
        <article className="panel span-2">
          <div className="panel-heading"><div><h3>Recent purchase orders</h3><p>Latest procurement activity</p></div><button className="text-button" onClick={() => setModule("Purchase Orders")}>View all →</button></div>
          <div className="table-wrap"><table><thead><tr><th>PO number</th><th>Supplier</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>{pos.slice(0,4).map(po => <tr key={po.id}><td><strong className="linkish">{po.number}</strong></td><td>{po.supplier}</td><td>{dateLabel(po.date)}</td><td>{peso.format(poAmount(po))}</td><td><Badge value={po.status}/></td></tr>)}</tbody></table></div>
        </article>
        <article className="panel">
          <div className="panel-heading"><div><h3>Low-stock items</h3><p>Items at or below reorder level</p></div><span className="count-pill">6 items</span></div>
          <div className="stock-list">
            {[["Printer Ink, Black","12","20","60%"],["Legal-size Folder","34","50","68%"],["Alcohol, 500ml","18","40","45%"],["Whiteboard Marker","9","24","38%"]].map(row => <div className="stock-item" key={row[0]}><div><strong>{row[0]}</strong><small>{row[1]} remaining · Reorder at {row[2]}</small><span><i style={{width:row[3]}}/></span></div><Badge value="Low stock"/></div>)}
          </div>
        </article>
      </section>
      {iars.length > 0 && <section className="activity-strip">
        <div><span className="activity-icon">IA</span><p><strong>{iars[0].number} updated</strong><small>Latest inspection and acceptance activity</small></p><time>Recent</time></div>
      </section>}
    </>
  );
}

function PurchaseOrders({ pos, setPos, openPO, onCreateIAR }: { pos: PurchaseOrder[]; setPos: (p: PurchaseOrder[]) => void; openPO: () => void; onCreateIAR: (po: PurchaseOrder) => void }) {
  const [query, setQuery] = useState("");
  const [status,setStatus]=useState("All statuses");
  const [page,setPage]=useState(1);
  const filtered = pos.filter(po => `${po.number} ${po.supplier} ${po.status}`.toLowerCase().includes(query.toLowerCase()));
  const statusFiltered=filtered.filter(po=>status==="All statuses"||po.status===status);
  const pageSize=5; const pageCount=Math.max(1,Math.ceil(statusFiltered.length/pageSize)); const visible=statusFiltered.slice((page-1)*pageSize,page*pageSize);
  const complete = (id: string | number) => setPos(pos.map(po => po.id === id ? { ...po, status: "Completed" } : po));
  return (
    <>
      <section className="page-heading"><div><h2>Purchase Orders</h2><p>Encode, track, and manage all purchase orders.</p></div><button className="primary-button" onClick={openPO}>＋ Create purchase order</button></section>
      <section className="mini-stats">
        <div><span>All purchase orders</span><strong>{pos.length}</strong></div><div><span>Active</span><strong>{pos.filter(p=>p.status!=="Cancelled").length}</strong></div><div><span>Completed</span><strong>{pos.filter(p=>p.status==="Completed").length}</strong></div><div><span>Total value</span><strong>{peso.format(pos.reduce((a,p)=>a+poAmount(p),0))}</strong></div>
      </section>
      <section className="panel">
        <div className="toolbar"><label className="search">⌕<input value={query} onChange={e=>{setQuery(e.target.value);setPage(1)}} placeholder="Search PO number or supplier…" /></label><div><select aria-label="Filter status" value={status} onChange={e=>{setStatus(e.target.value);setPage(1)}}><option>All statuses</option><option>Draft</option><option>Completed</option><option>Cancelled</option></select><button className="secondary-button" onClick={()=>downloadCsv("purchase-orders.csv",["PO Number","Date","Supplier","PR No.","Procurement Mode","Line Items","Amount","Status"],statusFiltered.map(po=>[po.number,po.date,po.supplier,po.pr,po.mode,po.lineCount??1,poAmount(po),po.status]))}>⇩ Export</button></div></div>
        <div className="table-wrap"><table className="data-table"><thead><tr><th>PO number</th><th>PO date</th><th>Supplier / PR no.</th><th>Procurement mode</th><th>Line items</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead><tbody>{visible.map(po => <tr key={po.id}><td><strong className="linkish">{po.number}</strong></td><td>{dateLabel(po.date)}</td><td><strong>{po.supplier}</strong><small>{po.pr || "No PR number"}</small></td><td>{po.mode}</td><td>{po.lineCount ?? 1}</td><td><strong>{peso.format(poAmount(po))}</strong></td><td><Badge value={po.status}/></td><td><div className="row-actions">{po.status==="Draft" && <button onClick={()=>complete(po.id)}>Complete</button>}{po.status==="Completed" && <button onClick={()=>onCreateIAR(po)}>Create IAR</button>}<button aria-label={`More actions for ${po.number}`} onClick={()=>tell(`${po.number}\nSupplier: ${po.supplier}\nDate: ${dateLabel(po.date)}\nAmount: ${peso.format(poAmount(po))}\nStatus: ${po.status}`)}>•••</button></div></td></tr>)}</tbody></table></div>
        <div className="pagination"><span>Showing {statusFiltered.length?((page-1)*pageSize)+1:0}–{Math.min(page*pageSize,statusFiltered.length)} of {statusFiltered.length} purchase orders</span><div><button disabled={page===1} onClick={()=>setPage(value=>Math.max(1,value-1))}>‹</button>{Array.from({length:pageCount},(_,index)=>index+1).map(value=><button key={value} className={page===value?"active":""} onClick={()=>setPage(value)}>{value}</button>)}<button disabled={page===pageCount} onClick={()=>setPage(value=>Math.min(pageCount,value+1))}>›</button></div></div>
      </section>
    </>
  );
}

function IARModule({ iars, setIars, pos, onCreate, onReviewCategories }: { iars: IAR[]; setIars: (x: IAR[]) => void; pos:PurchaseOrder[]; onCreate:(po:PurchaseOrder)=>void; onReviewCategories:()=>void }) {
  const [query,setQuery]=useState(""); const [filter,setFilter]=useState("All statuses");
  const visible=iars.filter(iar=>`${iar.number} ${iar.poNumber} ${iar.supplier}`.toLowerCase().includes(query.toLowerCase())).filter(iar=>filter==="All statuses"||iar.status===filter);
  const completeIAR = (iar: IAR) => {
    const classification: Classification = iar.item.toLowerCase().includes("paper") ? "Expendable" : iar.item.toLowerCase().includes("computer") ? "Capital Outlay" : "Semi-Expendable";
    setIars(iars.map(x => x.id === iar.id ? { ...x, status: "Completed", classification } : x));
  };
  return (
    <>
      <section className="page-heading"><div><h2>Inspection and Acceptance Reports</h2><p>Inspect deliveries and process only accepted quantities into inventory.</p></div><button className="primary-button" onClick={()=>{const eligible=pos.find(po=>po.status==="Completed"&&!iars.some(iar=>iar.poNumber===po.number));eligible?onCreate(eligible):tell("There is no completed Purchase Order available for a new IAR.")}}>＋ Create from completed PO</button></section>
      <section className="process-line"><div className="done"><b>1</b><span>Purchase order<small>Completed</small></span></div><i/><div className="current"><b>2</b><span>Inspection & acceptance<small>Validate delivery</small></span></div><i/><div><b>3</b><span>Item classification<small>Automatic by category</small></span></div><i/><div><b>4</b><span>Inventory records<small>Batches or property units</small></span></div></section>
      <section className="panel">
        <div className="toolbar"><label className="search">⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search IAR or PO number…" /></label><select aria-label="Filter IAR status" value={filter} onChange={e=>setFilter(e.target.value)}><option>All statuses</option><option>Draft</option><option>Partially Inspected</option><option>Completed</option><option>Cancelled</option></select></div>
        <div className="table-wrap"><table className="data-table"><thead><tr><th>IAR number</th><th>Related PO</th><th>Supplier</th><th>Date</th><th>Accepted</th><th>Classification</th><th>Status</th><th>Actions</th></tr></thead><tbody>{visible.map(iar => <tr key={iar.id}><td><strong className="linkish">{iar.number}</strong></td><td>{iar.poNumber}</td><td>{iar.supplier}</td><td>{dateLabel(iar.date)}</td><td><strong>{iar.accepted}</strong> / {iar.delivered}</td><td>{iar.classification ? <span className={`class-tag ${iar.classification.split(" ")[0].toLowerCase()}`}>{iar.classification}</span> : <span className="muted">Upon completion</span>}</td><td><Badge value={iar.status}/></td><td><div className="row-actions">{iar.status!=="Completed" && <button onClick={()=>completeIAR(iar)}>Complete & process</button>}<button onClick={()=>tell(`${iar.number}\nRelated PO: ${iar.poNumber}\nSupplier: ${iar.supplier}\nAccepted: ${iar.accepted} of ${iar.delivered}\nStatus: ${iar.status}`)}>View</button></div></td></tr>)}</tbody></table></div>
      </section>
      <section className="info-banner"><span>i</span><div><strong>Classification rule in effect</strong><p>Consumables are expendable. Property below ₱50,000 per item is semi-expendable; qualifying PPE at ₱50,000 or above is capital outlay. Manual corrections require a reason.</p></div><button onClick={onReviewCategories}>Review categories</button></section>
    </>
  );
}

function RISModule({ transfer }: { transfer: DmwTransferData | null }) {
  const [issued, setIssued] = useState(false);
  const data = transfer?.data;
  const offices = rowsById(data?.offices);
  const items = rowsById(data?.items);
  const risItems = data?.requisition_issue_slip_items ?? [];
  const allocations = data?.ris_batch_allocations ?? [];
  const allocationByRisItem = new Map<string, number>();
  allocations.forEach(row => allocationByRisItem.set(textValue(row, "ris_item_id"), (allocationByRisItem.get(textValue(row, "ris_item_id")) ?? 0) + numberValue(row, "total_value")));
  const transactions = (data?.requisition_issue_slips ?? []).map(row => {
    const lines = risItems.filter(line => textValue(line, "ris_id") === textValue(row, "id"));
    return { row, lines, value: lines.reduce((sum, line) => sum + (allocationByRisItem.get(textValue(line, "id")) ?? 0), 0) };
  }).sort((a, b) => textValue(b.row, "ris_date").localeCompare(textValue(a.row, "ris_date")));
  const openBatches = (data?.inventory_batches ?? []).filter(row => numberValue(row, "quantity_remaining") > 0 && textValue(row, "status") !== "Cancelled").sort((a,b)=>textValue(a,"date_received").localeCompare(textValue(b,"date_received")));
  const unitsOnHand = openBatches.reduce((sum,row)=>sum+numberValue(row,"quantity_remaining"),0);
  const inventoryValue = openBatches.reduce((sum,row)=>sum+numberValue(row,"quantity_remaining")*numberValue(row,"unit_cost"),0);
  const issuedUnits = risItems.reduce((sum,row)=>sum+numberValue(row,"quantity_issued"),0);
  return (
    <>
      <section className="page-heading"><div><h2>Requisition and Issue Slips</h2><p>Issue expendable supplies using first-in, first-out inventory costing.</p></div><button className="primary-button" onClick={()=>setIssued(true)}>＋ New RIS</button></section>
      {issued && <div className="success-banner"><b>✓</b><div><strong>RIS-2026-0120 issued successfully</strong><p>18 units were deducted from the oldest available batches. Running balances and the stock ledger were updated.</p></div><button onClick={()=>setIssued(false)}>×</button></div>}
      <section className="mini-stats"><div><span>Available item types</span><strong>{new Set(openBatches.map(row=>textValue(row,"item_id"))).size}</strong></div><div><span>Units on hand</span><strong>{number.format(unitsOnHand)}</strong></div><div><span>Issued units</span><strong>{number.format(issuedUnits)}</strong></div><div><span>Inventory value</span><strong>{peso.format(inventoryValue)}</strong></div></section>
      <section className="dashboard-grid">
        <article className="panel span-2"><div className="panel-heading"><div><h3>Recent RIS transactions</h3><p>Imported issue records and their saved batch allocations</p></div><button className="secondary-button" onClick={()=>window.print()}>Print RSMI</button></div><div className="table-wrap"><table><thead><tr><th>RIS number</th><th>Date</th><th>Requesting office</th><th>Line items</th><th>Value</th><th>Status</th></tr></thead><tbody>{transactions.map(({row,lines,value})=><tr key={textValue(row,"id")}><td><strong className="linkish">{textValue(row,"ris_number")}</strong></td><td>{dateLabel(row.ris_date)}</td><td>{textValue(offices.get(textValue(row,"requesting_office_id")),"name")||"—"}</td><td>{lines.length}</td><td>{peso.format(value)}</td><td><Badge value={textValue(row,"status")||"Draft"}/></td></tr>)}</tbody></table></div></article>
        <article className="panel"><div className="panel-heading"><div><h3>FIFO batch availability</h3><p>Oldest remaining imported batches first</p></div></div><div className="batch-list">{openBatches.slice(0,8).map(batch=>{const item=items.get(textValue(batch,"item_id"));return <div key={textValue(batch,"id")}><span><strong>{textValue(item,"item_name")}</strong><small>{textValue(batch,"batch_number")} · {dateLabel(batch.date_received)}</small></span><span><strong>{number.format(numberValue(batch,"quantity_remaining"))} {textValue(item,"unit_of_measure")}</strong><small>{peso.format(numberValue(batch,"unit_cost"))} / unit</small></span></div>})}</div></article>
      </section>
    </>
  );
}

function PropertyRecords({ transfer }: { transfer: DmwTransferData | null }) {
  const [classification,setClassification]=useState<"Semi-Expendable"|"Capital Outlay"|null>(null);
  const [query,setQuery]=useState("");
  const [conditionOverrides,setConditionOverrides]=useState<Record<string,string>>({});
  const data=transfer?.data;
  const items=rowsById(data?.items); const employees=rowsById(data?.employees); const suppliers=rowsById(data?.suppliers);
  const units=(data?.property_units??[]).filter(row=>textValue(row,"classification")===classification).filter(row=>`${textValue(row,"property_number")} ${textValue(row,"inventory_item_number")} ${textValue(row,"item_description")} ${textValue(row,"brand")} ${textValue(row,"model")} ${textValue(row,"serial_number")}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>(textValue(a,"property_number")||textValue(a,"inventory_item_number")).localeCompare(textValue(b,"property_number")||textValue(b,"inventory_item_number")));
  const allUnits=data?.property_units??[];
  const semi=allUnits.filter(row=>textValue(row,"classification")==="Semi-Expendable"); const capital=allUnits.filter(row=>textValue(row,"classification")==="Capital Outlay");
  return <>
    <section className="page-heading"><div><h2>Property Records</h2><p>Individual semi-expendable and capital-outlay units created from completed IARs.</p></div><div><button className="secondary-button" onClick={()=>downloadCsv("property-records.csv",["Property / Inventory No.","Classification","Item","Brand","Model","Serial No.","PPE No.","Acquisition Cost","Date Acquired","Issued To","Condition"],units.map(row=>{const item=items.get(textValue(row,"item_id"));const employee=employees.get(textValue(row,"issued_to_employee_id"));return [textValue(row,"inventory_item_number")||textValue(row,"property_number"),textValue(row,"classification"),textValue(row,"item_description")||textValue(item,"item_name"),textValue(row,"brand"),textValue(row,"model"),textValue(row,"serial_number"),textValue(row,"property_number"),numberValue(row,"acquisition_cost"),textValue(row,"date_acquired"),textValue(employee,"full_name"),conditionOverrides[textValue(row,"id")]||textValue(row,"condition")] }))}>⇩ Export CSV</button> <button className="secondary-button" onClick={()=>window.print()}>Print list</button></div></section>
    <section className="property-summary"><article role="button" tabIndex={0} onClick={()=>setClassification("Semi-Expendable")}><span className="metric-icon violet">SE</span><div><p>Semi-Expendable</p><strong>{semi.length} units</strong><small>{peso.format(semi.reduce((sum,row)=>sum+numberValue(row,"acquisition_cost"),0))} acquisition value</small></div></article><article role="button" tabIndex={0} onClick={()=>setClassification("Capital Outlay")}><span className="metric-icon navy">CO</span><div><p>Capital Outlay</p><strong>{capital.length} units</strong><small>{peso.format(capital.reduce((sum,row)=>sum+numberValue(row,"acquisition_cost"),0))} acquisition value</small></div></article><article><span className="metric-icon amber">MI</span><div><p>Missing identifiers</p><strong>{allUnits.filter(row=>!textValue(row,"property_number")&&!textValue(row,"inventory_item_number")).length} units</strong><small>Property or inventory number required</small></div></article></section>
    {!classification?<section className="panel master-empty"><b>PR</b><p>Choose a property master list above.<small>Semi-Expendable and Capital Outlay records remain separate.</small></p></section>:<section className="panel"><div className="toolbar toolbar-wrap"><label className="search">⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search property/inventory no., item, brand, model, or serial…"/></label><div><button className="secondary-button" onClick={()=>setClassification(null)}>Change master list</button></div></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Property / Inventory No.</th><th>Item</th><th>Brand</th><th>Model</th><th>Serial No.</th><th>PPE No.</th><th>Acquisition</th><th>Issued to</th><th>Condition</th><th>Actions</th></tr></thead><tbody>{units.map(row=>{const id=textValue(row,"id");const item=items.get(textValue(row,"item_id"));const employee=employees.get(textValue(row,"issued_to_employee_id"));const supplier=suppliers.get(textValue(row,"supplier_id"));const label=textValue(row,"inventory_item_number")||textValue(row,"property_number")||"Needs assignment";return <tr key={id}><td><strong className="linkish">{label}</strong></td><td><strong>{textValue(row,"item_description")||textValue(item,"item_name")}</strong><small>{textValue(supplier,"supplier_name")||"No supplier"}</small></td><td>{textValue(row,"brand")||"N/A"}</td><td>{textValue(row,"model")||"N/A"}</td><td>{textValue(row,"serial_number")||"N/A"}</td><td>{textValue(row,"property_number")||"—"}</td><td><strong>{peso.format(numberValue(row,"acquisition_cost"))}</strong><small>{dateLabel(row.date_acquired)}</small></td><td>{textValue(employee,"full_name")||"Unassigned"}</td><td>{conditionOverrides[id]||textValue(row,"condition")||"—"}</td><td><details className="action-menu"><summary aria-label={`Actions for ${label}`}>•••</summary><div><button onClick={()=>tell(`${classification==="Semi-Expendable"?"ICS":"PAR"} editor opened for ${label}.\nInventory/PPE No.: ${label}\nItem: ${textValue(row,"item_description")}`)}>Edit {classification==="Semi-Expendable"?"ICS":"PAR"}</button><button onClick={()=>tell(`${classification==="Semi-Expendable"?"ICS":"PAR"} details\n${label}\n${textValue(row,"item_description")}\nIssued to: ${textValue(employee,"full_name")||"Unassigned"}`)}>View {classification==="Semi-Expendable"?"ICS":"PAR"}</button><button onClick={()=>tell(`Transfer workflow opened for ${label}. Select the new employee from the Employees master list when completing the transfer form.`)}>Transfer</button><button onClick={()=>{setConditionOverrides(current=>({...current,[id]:"Unserviceable"}));tell(`${label} is now marked Unserviceable in this session.`)}}>Unserviceable</button></div></details></td></tr>})}</tbody></table></div></section>}
  </>;
}

type AdminSection = "Employees" | "Plantilla" | "Users" | "Branding" | "General";
type GuideStep = "employee" | "plantilla" | "users" | "complete";
type EmployeeRecord = { id: string | number; name: string; position?: string; division?: string; employeeNumber?: string; active?: boolean };
type PlantillaRecord = { id: string | number; title: string };
type UserRole = "Superadmin" | "Admin" | "Staff" | "Viewer";
type WorkspaceUser = { id: string | number; name: string; email: string; role: UserRole; status: "Active" | "Pending"; employee?: string; position?: string };

function Admin({ threshold, setThreshold, theme, setTheme, guideStep, setGuideStep, section, setSection, employees, setEmployees, plantilla, setPlantilla, users, setUsers }: {
  threshold: number; setThreshold: (n: number) => void; theme: AgencyTheme; setTheme: (theme: AgencyTheme) => void;
  guideStep: GuideStep; setGuideStep: (step: GuideStep) => void; section: AdminSection; setSection: (section: AdminSection) => void;
  employees: EmployeeRecord[]; setEmployees: (rows: EmployeeRecord[]) => void; plantilla: PlantillaRecord[]; setPlantilla: (rows: PlantillaRecord[]) => void;
  users: WorkspaceUser[]; setUsers: (rows: WorkspaceUser[]) => void;
}) {
  const [saved, setSaved] = useState(false);
  const [employeeName, setEmployeeName] = useState("");
  const [positionTitle, setPositionTitle] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [accountRole, setAccountRole] = useState<UserRole>("Staff");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);
  const tabs: AdminSection[] = ["Employees", "Plantilla", "Users", "Branding", "General"];
  const progress = guideStep === "employee" ? 1 : guideStep === "plantilla" ? 2 : guideStep === "users" ? 3 : 3;
  const advance = (next: GuideStep, destination: AdminSection) => { setGuideStep(next); setSection(destination); };
  const updateRole = (id: string | number, role: UserRole) => setUsers(users.map(user => user.id === id ? { ...user, role } : user));
  return (
    <>
      <section className="page-heading"><div><h2>Admin Options</h2><p>Set up people, positions, access roles, agency colors, and operating rules.</p></div></section>
      <section className={`admin-guide ${guideStep === "complete" ? "complete" : ""}`}>
        <div className="admin-guide-copy"><span>{guideStep === "complete" ? "WORKSPACE READY" : `FIRST-TIME SETUP · STEP ${progress} OF 3`}</span><h3>{guideStep === "employee" ? "Start by creating an employee" : guideStep === "plantilla" ? "Now add a plantilla position" : guideStep === "users" ? "Create or invite a user, then assign a role" : "Your core access setup is complete"}</h3><p>Employee → Plantilla → User account → Role. Sinop highlights the next required area while you configure the workspace.</p></div>
        <div className="admin-guide-steps"><button className={guideStep === "employee" ? "current" : employees.length ? "done" : ""} onClick={()=>setSection("Employees")}><b>{employees.length ? "✓" : "1"}</b><span>Employee</span></button><i/><button className={guideStep === "plantilla" ? "current" : plantilla.length ? "done" : ""} onClick={()=>setSection("Plantilla")}><b>{plantilla.length ? "✓" : "2"}</b><span>Plantilla</span></button><i/><button className={guideStep === "users" ? "current" : guideStep === "complete" ? "done" : ""} onClick={()=>setSection("Users")}><b>{guideStep === "complete" ? "✓" : "3"}</b><span>User & role</span></button></div>
      </section>
      <div className="admin-tabs" role="tablist">{tabs.map(tab=><button role="tab" aria-selected={section===tab} className={section===tab?"active":""} key={tab} onClick={()=>setSection(tab)}>{tab}{tab==="Users"&&<span>{users.length}</span>}</button>)}</div>

      {section === "Employees" && <section className="admin-master-grid"><article className="panel admin-entry"><div className="panel-heading"><div><h3>Add employee</h3><p>Create the employee master record first.</p></div></div><form onSubmit={event=>{event.preventDefault();const name=employeeName.trim();if(!name)return;setEmployees([...employees,{id:Date.now(),name}]);setEmployeeName("");advance("plantilla","Plantilla")}}><label>Employee Name<input value={employeeName} onChange={e=>setEmployeeName(e.target.value)} placeholder="Complete name" required/></label><button className="primary-button">Add employee and continue →</button></form></article><article className="panel"><div className="panel-heading"><div><h3>Employees</h3><p>{employees.length} master record{employees.length===1?"":"s"}</p></div></div>{employees.length?<div className="simple-master-list">{employees.map(row=><div key={row.id}><span className="master-avatar">{row.name.split(" ").map(v=>v[0]).slice(0,2).join("")}</span><strong>{row.name}</strong><Badge value="Active"/></div>)}</div>:<div className="master-empty"><b>01</b><p>No employees yet.<small>Add the first employee to unlock the next guided step.</small></p></div>}</article></section>}

      {section === "Plantilla" && <section className="admin-master-grid"><article className="panel admin-entry"><div className="panel-heading"><div><h3>Add plantilla position</h3><p>Maintain the agency’s authorized position list.</p></div></div><form onSubmit={event=>{event.preventDefault();const title=positionTitle.trim();if(!title)return;setPlantilla([...plantilla,{id:Date.now(),title}]);setPositionTitle("");advance("users","Users")}}><label>Position Title<input value={positionTitle} onChange={e=>setPositionTitle(e.target.value)} placeholder="e.g. Administrative Officer V" required/></label><button className="primary-button">Add position and continue →</button></form></article><article className="panel"><div className="panel-heading"><div><h3>Plantilla</h3><p>{plantilla.length} position{plantilla.length===1?"":"s"}</p></div></div>{plantilla.length?<div className="simple-master-list">{plantilla.map(row=><div key={row.id}><span className="master-avatar">PL</span><strong>{row.title}</strong><Badge value="Active"/></div>)}</div>:<div className="master-empty"><b>02</b><p>No plantilla positions yet.<small>Add one position before assigning user access.</small></p></div>}</article></section>}

      {section === "Users" && <><section className="account-methods"><article className="panel admin-entry"><div className="panel-heading"><div><h3>Create an account</h3><p>Superadmins can create an account directly.</p></div><span className="method-tag">DIRECT</span></div><form onSubmit={event=>{event.preventDefault();if(!accountName.trim()||!accountEmail.trim())return;setUsers([...users,{id:Date.now(),name:accountName.trim(),email:accountEmail.trim(),role:accountRole,status:"Active"}]);setAccountName("");setAccountEmail("");setGuideStep("complete")}}><label>Full Name<input value={accountName} onChange={e=>setAccountName(e.target.value)} placeholder="Account holder" required/></label><label>Email Address<input type="email" value={accountEmail} onChange={e=>setAccountEmail(e.target.value)} placeholder="name@agency.gov.ph" required/></label><label>Role<select value={accountRole} onChange={e=>setAccountRole(e.target.value as UserRole)}><option>Superadmin</option><option>Admin</option><option>Staff</option><option>Viewer</option></select></label><button className="primary-button">Create account</button></form></article><article className="panel admin-entry"><div className="panel-heading"><div><h3>Send a registration link</h3><p>Let the person complete their own registration.</p></div><span className="method-tag">INVITE</span></div><form onSubmit={event=>{event.preventDefault();const token=Math.random().toString(36).slice(2,10).toUpperCase();setInviteLink(`https://app.sinop.ph/register/${registrationAccount(theme.agencyName)}?invite=${token}`);setGuideStep("complete")}}><label>Invitee Email <small>Optional</small><input type="email" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="name@agency.gov.ph"/></label><button className="secondary-button">Generate secure registration link</button>{inviteLink&&<div className="invite-link-box"><span>Registration link</span><input readOnly value={inviteLink}/><div><button type="button" className="primary-button" onClick={async()=>{await navigator.clipboard?.writeText(inviteLink);setCopied(true);setTimeout(()=>setCopied(false),1800)}}>{copied?"✓ Copied":"Copy link"}</button>{inviteEmail&&<a className="secondary-button" href={`mailto:${encodeURIComponent(inviteEmail)}?subject=${encodeURIComponent("Your Sinop workspace invitation")}&body=${encodeURIComponent(`Use this secure link to register: ${inviteLink}`)}`}>Open email draft</a>}</div></div>}</form></article></section><section className="panel user-role-panel"><div className="panel-heading"><div><h3>Users and roles</h3><p>The Superadmin can change roles at any time.</p></div></div>{users.length?<div className="table-wrap"><table><thead><tr><th>User</th><th>Email</th><th>Status</th><th>Role</th></tr></thead><tbody>{users.map(user=><tr key={user.id}><td><strong>{user.name}</strong></td><td>{user.email}</td><td><Badge value={user.status}/></td><td><select aria-label={`Role for ${user.name}`} value={user.role} onChange={e=>updateRole(user.id,e.target.value as UserRole)}><option>Superadmin</option><option>Admin</option><option>Staff</option><option>Viewer</option></select></td></tr>)}</tbody></table></div>:<div className="master-empty"><b>03</b><p>No additional users yet.<small>Create the account directly or generate a registration link.</small></p></div>}</section></>}

      {section === "Branding" && <section className="panel branding-settings"><div className="panel-heading"><div><h3>Agency colors</h3><p>Choose two required colors and an optional third. Changes apply instantly throughout the dashboard.</p></div><Badge value="Active"/></div><ThemePicker colors={theme.colors} onChange={colors=>setTheme({...theme,colors})}/><div className="branding-live-preview" style={themeVariables(theme)}><aside><img src="/sinop-mark.svg" alt=""/><b>{theme.agencyName}</b><span>Dashboard</span><span>Inventory</span><span>Reports</span></aside><main><small>LIVE COLOR PREVIEW</small><h3>Readable by design</h3><p>Sinop selects the safest navigation tone and calculates text contrast automatically.</p><button>Primary action</button></main></div></section>}

      {section === "General" && <><section className="settings-grid"><article className="panel"><div className="panel-heading"><div><h3>Acquisition-cost threshold</h3><p>Applied to each individual accepted property item.</p></div></div><div className="setting-form"><label>Capitalization threshold<span className="money-input"><b>₱</b><input type="number" value={threshold} onChange={e=>setThreshold(Number(e.target.value))}/></span></label><p>Qualifying PPE at or above this unit cost is classified as Capital Outlay.</p><button className="primary-button" onClick={()=>{setSaved(true);setTimeout(()=>setSaved(false),2500)}}>{saved ? "✓ Setting saved" : "Save setting"}</button></div></article><article className="panel"><div className="panel-heading"><div><h3>Classification summary</h3><p>Configured item category behavior</p></div></div><div className="classification-summary"><div><span className="dot expendable"/><p><strong>Expendable</strong><small>Consumable supplies and materials</small></p><b>24 categories</b></div><div><span className="dot semi"/><p><strong>Semi-Expendable</strong><small>Property below the threshold</small></p><b>11 categories</b></div><div><span className="dot capital"/><p><strong>Capital Outlay</strong><small>Qualifying property at or above threshold</small></p><b>9 categories</b></div></div></article></section></>}
    </>
  );
}

function Reports({ setModule }: { setModule: (module: Module) => void }) {
  return (
    <>
      <section className="page-heading"><div><h2>Reports</h2><p>Prepare monthly inventory, property, and accountability reports.</p></div><div className="report-period"><label>Period<input type="month" defaultValue="2026-07"/></label></div></section>
      <section className="report-grid">
        <article className="report-card"><span>RI</span><div><h3>Requisition and Issue Slips</h3><strong>RIS transactions and register</strong><p>Create, complete, print, and review requisition and issue slips.</p><small>Operational report module</small></div><button onClick={()=>setModule("Requisition and Issue Slips")}>Open RIS →</button></article>
        {[
          ["RSMI","Report of Supplies and Materials Issued","Monthly summary of expendable inventory issues.","Monthly · July 2026"],
          ["RPCPPE","Report on the Physical Count of PPE","Capital outlay property count and reconciliation.","Annual / On demand"],
          ["RPCSP","Report on the Physical Count of Semi-Expendable Property","Semi-expendable units by category and custodian.","Annual / On demand"],
          ["Stock Card","Expendable stock movement ledger","Receipts, issues, balances, and source batches per item.","Real-time"],
          ["Property Card","Property record by asset","Acquisition, location, custodian, and status history.","Real-time"],
          ["PO & IAR Register","Procurement receipt register","Purchase orders matched with inspection and acceptance activity.","Monthly · July 2026"],
        ].map((r,i)=><article className="report-card" key={r[0]}><span>{["RS","PP","SP","SC","PC","PI"][i]}</span><div><h3>{r[0]}</h3><strong>{r[1]}</strong><p>{r[2]}</p><small>{r[3]}</small></div><button onClick={()=>{document.title=`${r[0]} | Sinop`;window.print()}}>Generate →</button></article>)}
      </section>
      <section className="panel"><div className="panel-heading"><div><h3>July 2026 reporting readiness</h3><p>Source records included in the selected period</p></div><Badge value="On track"/></div><div className="readiness"><div><b>42</b><span>Completed POs</span></div><div><b>38</b><span>Completed IARs</span></div><div><b>119</b><span>RIS transactions</span></div><div><b>0</b><span>Unposted records</span></div><div className="ready-check">✓ All completed transactions are ready for reporting</div></div></section>
    </>
  );
}

function PurchaseOrderModal({ onClose, onSave, transfer }: { onClose: () => void; onSave: (po: PurchaseOrder) => void; transfer: DmwTransferData | null }) {
  const [supplierAddress, setSupplierAddress] = useState("");
  const [lines,setLines]=useState([{id:Date.now(),itemId:"",quantity:1,cost:0}]);
  const transferSuppliers=(transfer?.data.suppliers??[]).map(row=>({name:textValue(row,"supplier_name"),address:textValue(row,"address")})).sort((a,b)=>a.name.localeCompare(b.name));
  const availableSuppliers=transferSuppliers.length?transferSuppliers:supplierOptions;
  const transferItems=(transfer?.data.items??[]).filter(row=>Boolean(row.active)).sort((a,b)=>textValue(a,"item_name").localeCompare(textValue(b,"item_name")));
  const transferModes=(transfer?.data.system_settings??[]).filter(row=>textValue(row,"setting_key").startsWith("procurement_mode:")).map(row=>textValue(row,"text_value")).sort();
  const availableModes=transferModes.length?transferModes:procurementModes;
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const status: POStatus = submitter?.value === "approve" ? "Completed" : "Draft";
    const selected=lines.map(line=>({...line,item:transferItems.find(row=>textValue(row,"id")===line.itemId)}));
    if(selected.some(line=>!line.item)){tell("Select an Item Description for every line item.");return;}
    const first=selected[0]; const total=selected.reduce((sum,line)=>sum+line.quantity*line.cost,0);
    onSave({ id: Date.now(), number: String(fd.get("number")), date: String(fd.get("date")), supplier: String(fd.get("supplier")), pr: String(fd.get("pr")), mode: String(fd.get("mode")), fund: String(fd.get("fund")), status, item:selected.length===1?textValue(first.item,"item_name"):`${selected.length} line items`, category: "Imported master item", quantity:selected.reduce((sum,line)=>sum+line.quantity,0), unit:selected.length===1?textValue(first.item,"unit_of_measure"):"Mixed", unitCost:first.cost, total, lineCount:selected.length });
  };
  return (
    <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
      <form className="drawer po-drawer" onSubmit={submit}>
        <div className="drawer-head"><div><p>New transaction</p><h2>Create purchase order</h2></div><button type="button" onClick={onClose} aria-label="Close">×</button></div>
        <div className="drawer-body">
          <h3>PO header information</h3>
          <div className="form-grid">
            <label>PO number <span className="required-mark">*</span><input name="number" placeholder="Enter PO number" required/><small className="field-hint">Required. Enter the official PO number manually.</small></label>
            <label>PO date <span className="required-mark">*</span><input name="date" type="date" required/><small className="field-hint">Required before saving or approval.</small></label>
            <label className="wide">Supplier <span className="required-mark">*</span><select name="supplier" defaultValue="" required onChange={e=>setSupplierAddress(availableSuppliers.find(supplier=>supplier.name===e.target.value)?.address||"")}><option value="" disabled>Select supplier from master data</option>{availableSuppliers.map(supplier=><option key={supplier.name} value={supplier.name}>{supplier.name}</option>)}</select></label>
            <label className="wide">Supplier address<textarea value={supplierAddress} placeholder="Select a supplier to load its address" readOnly/><small className="field-hint">Linked to the supplier master record. Edit this address under Admin Options → Suppliers.</small></label>
            <label>Purchase Request no. <span className="optional-mark">Optional</span><input name="pr" placeholder="May be left blank"/></label>
            <label>Mode of procurement <span className="required-mark">*</span><select name="mode" defaultValue="" required><option value="" disabled>Select mode under RA 12009</option>{availableModes.map(mode=><option key={mode}>{mode}</option>)}</select></label>
            <label className="wide">Delivery location<input value="3rd Floor Esquina Dos Bldg, J.C. Aquino Ave, Butuan City" readOnly/><small className="field-hint">Permanent delivery location</small></label>
            <label>Delivery period<input placeholder="15 calendar days"/></label>
            <label>Fund source<select name="fund" defaultValue="Regular Fund 01"><option>Regular Fund 01</option></select></label>
          </div>
          <div className="po-items-heading"><div><h3>Purchase order items</h3><p>Enter the item details and acquisition cost.</p></div><button type="button" onClick={()=>setLines(current=>[...current,{id:Date.now()+current.length,itemId:"",quantity:1,cost:0}])}>＋ Add item</button></div>
          <div className="po-item-table-wrap">
            <table className="po-item-editor">
              <thead><tr><th>Item No.</th><th>UOM</th><th>Item Description</th><th>QTY</th><th>Unit Cost</th><th>Total Cost</th><th>Remove</th></tr></thead>
              <tbody>{lines.map((line,index)=>{const selectedItem=transferItems.find(row=>textValue(row,"id")===line.itemId);return <tr key={line.id}>
                <td><input aria-label={`Item number ${index+1}`} value={index+1} readOnly/></td>
                <td><input aria-label={`Unit of measure ${index+1}`} value={textValue(selectedItem,"unit_of_measure")} placeholder="Linked UOM" readOnly required/></td>
                <td><select aria-label={`Item description ${index+1}`} value={line.itemId} onChange={e=>setLines(current=>current.map(row=>row.id===line.id?{...row,itemId:e.target.value}:row))} required><option value="" disabled>Select from Items master list</option>{transferItems.map(item=><option key={textValue(item,"id")} value={textValue(item,"id")}>{textValue(item,"item_name")} — {textValue(item,"description")}</option>)}</select></td>
                <td><input aria-label={`Quantity ${index+1}`} type="number" min="1" value={line.quantity} onChange={e=>setLines(current=>current.map(row=>row.id===line.id?{...row,quantity:Number(e.target.value)}:row))}/></td>
                <td><input aria-label={`Unit cost ${index+1}`} type="number" min="0" step="0.01" value={line.cost} onChange={e=>setLines(current=>current.map(row=>row.id===line.id?{...row,cost:Number(e.target.value)}:row))}/></td>
                <td><output aria-label={`Total cost ${index+1}`}>{peso.format(line.quantity*line.cost)}</output></td>
                <td><button type="button" className="line-trash" aria-label={`Delete line item ${index+1}`} disabled={lines.length===1} onClick={()=>setLines(current=>current.filter(row=>row.id!==line.id))}>🗑</button></td>
              </tr>})}</tbody>
            </table>
          </div>
          <div className="po-grand-total"><span>Total Purchase Order Amount</span><strong>{peso.format(lines.reduce((sum,line)=>sum+line.quantity*line.cost,0))}</strong></div>
        </div>
        <div className="drawer-foot po-actions">
          <button className="secondary-button" name="intent" value="draft">Save as Draft</button>
          <button className="primary-button" name="intent" value="approve">Approve</button>
          <button type="button" className="cancel-button" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

function IARModal({ po, onClose, onSave }: { po: PurchaseOrder; onClose: () => void; onSave: (iar: IAR) => void }) {
  const [delivered, setDelivered] = useState(po.quantity);
  const [accepted, setAccepted] = useState(po.quantity);
  const invalid = accepted > delivered || delivered > po.quantity;
  return <div className="modal-backdrop"><form className="drawer" onSubmit={e=>{e.preventDefault();if(!invalid)onSave({id:Date.now(),number:`IAR-2026-${String(Date.now()).slice(-4)}`,poNumber:po.number,supplier:po.supplier,date:"2026-07-25",delivered,accepted,rejected:delivered-accepted,status:accepted<po.quantity?"Partially Inspected":"Draft",item:po.item})}}><div className="drawer-head"><div><p>Create from {po.number}</p><h2>Inspection & Acceptance Report</h2></div><button type="button" onClick={onClose}>×</button></div><div className="drawer-body"><div className="source-card"><span>PO</span><div><strong>{po.number} · {po.supplier}</strong><p>{po.item} · {po.quantity} {po.unit} ordered at {peso.format(po.unitCost)} each</p></div><Badge value="Completed"/></div><h3>Report details</h3><div className="form-grid"><label>IAR number<input defaultValue="Auto-generated on save" disabled/></label><label>IAR date<input type="date" defaultValue="2026-07-25"/></label><label>Invoice number<input placeholder="Supplier invoice no."/></label><label>Invoice date<input type="date"/></label><label>Delivery Receipt no.<input placeholder="DR number"/></label><label>Delivery Receipt date<input type="date"/></label><label>Inspection date<input type="date" defaultValue="2026-07-25"/></label><label>Acceptance date<input type="date" defaultValue="2026-07-25"/></label></div><div className="form-section-title"><h3>Acceptance quantities</h3><span>Ordered: {po.quantity} {po.unit}</span></div><div className="form-grid thirds"><label>Quantity delivered<input type="number" min="0" max={po.quantity} value={delivered} onChange={e=>setDelivered(Number(e.target.value))}/></label><label>Quantity inspected<input type="number" value={delivered} readOnly/></label><label>Quantity accepted<input type="number" min="0" max={delivered} value={accepted} onChange={e=>setAccepted(Number(e.target.value))}/></label></div>{invalid && <p className="field-error">Accepted quantity cannot exceed delivered or ordered quantity.</p>}<label className="full-label">Condition<select><option>Good condition</option><option>With minor defects</option><option>Rejected</option></select></label><label className="full-label">Remarks<textarea placeholder="Inspection and acceptance notes"/></label></div><div className="drawer-foot"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={invalid}>Save IAR draft</button></div></form></div>;
}

type SubscriptionPlan = "Semestral" | "Yearly";
type PaymentMethod = "stripe" | "bank" | "check";
type CostFormula = "FIFO" | "Running Average";
type RegistrationData = { email: string; password: string; firstName: string; lastName: string; agencyName: string; plan: SubscriptionPlan; paymentMethod: PaymentMethod; accountNumber: string; receiptName?: string };
type AgencyTheme = { agencyName: string; agencyAddress: string; logoPreview: string; headerPreview: string; colors: string[]; formula: CostFormula };

const hexRgb = (hex: string) => {
  const clean = hex.replace("#", "").padEnd(6, "0").slice(0, 6);
  return [Number.parseInt(clean.slice(0,2),16),Number.parseInt(clean.slice(2,4),16),Number.parseInt(clean.slice(4,6),16)];
};

const poAmount = (po: PurchaseOrder) => po.total ?? po.quantity * po.unitCost;
const luminance = (hex: string) => {
  const values = hexRgb(hex).map(value=>{const channel=value/255;return channel<=.03928?channel/12.92:Math.pow((channel+.055)/1.055,2.4)});
  return .2126*values[0]+.7152*values[1]+.0722*values[2];
};
const mixHex = (from: string, to: string, amount: number) => {
  const a=hexRgb(from),b=hexRgb(to); return `#${a.map((value,index)=>Math.round(value+(b[index]-value)*amount).toString(16).padStart(2,"0")).join("")}`.toUpperCase();
};
const readableText = (color: string) => luminance(color) > .42 ? "#101820" : "#FFFFFF";
const safeDark = (color: string) => luminance(color) > .24 ? mixHex(color,"#08131C",.48) : color.toUpperCase();
const registrationAccount = (agencyName: string) => `SNP-${agencyName.replace(/[^a-z0-9]/gi,"").slice(0,4).toUpperCase()||"AGCY"}`;
const themeVariables = (theme: AgencyTheme) => {
  const ordered=[...theme.colors].sort((a,b)=>luminance(a)-luminance(b));
  const primary=safeDark(ordered[0]||"#0F2942");
  const accent=theme.colors.find(color=>color!==ordered[0])||"#059669";
  const third=theme.colors[2]||accent;
  return {"--tenant-primary":primary,"--tenant-primary-text":"#FFFFFF","--tenant-accent":accent,"--tenant-accent-text":readableText(accent),"--tenant-third":third,"--tenant-soft":mixHex(accent,"#FFFFFF",.88)} as CSSProperties;
};

function ThemePicker({ colors, onChange }: { colors: string[]; onChange: (colors: string[]) => void }) {
  return <div className="theme-picker"><div className="theme-picker-head"><div><span>FULL-SPECTRUM COLOR WHEELS</span><h4>Build your agency palette</h4><p>Two colors are required. A third color is optional. Sinop mixes them into navigation, actions, highlights, and readable surfaces.</p></div><b>{colors.length}/3 colors</b></div><div className="color-wheel-grid">{colors.map((color,index)=><label key={index}><span className="color-wheel-wrap"><input type="color" value={color} onChange={event=>onChange(colors.map((item,i)=>i===index?event.target.value.toUpperCase():item))}/><i style={{background:color}}/></span><strong>{index===0?"Agency color 1":index===1?"Agency color 2":"Agency color 3"}</strong><output>{color.toUpperCase()}</output>{index===2&&<button type="button" onClick={()=>onChange(colors.slice(0,2))}>Remove</button>}</label>)}</div>{colors.length<3&&<button type="button" className="add-third-color" onClick={()=>onChange([...colors,"#F59E0B"])}>＋ Add optional third color</button>}<div className="contrast-assurance"><b>Automatic readability protection</b><p>The darkest safe mixture becomes the navigation color. Buttons receive white or dark text based on measured contrast, while lighter mixtures are reserved for highlights and backgrounds.</p></div></div>;
}

function SinopRegistration({ initialPlan, onBack, onComplete }: { initialPlan: SubscriptionPlan; onBack: () => void; onComplete: (data: RegistrationData) => void }) {
  const [plan, setPlan] = useState<SubscriptionPlan>(initialPlan);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("stripe");
  const [receiptName, setReceiptName] = useState("");
  const [error, setError] = useState("");
  const accountNumber = "SNP-2026-00001";
  const price = plan === "Yearly" ? "₱125,000.00" : "₱68,750.00";
  return <div className="sinop-onboarding-page"><header><button onClick={onBack} className="sinop-logo" aria-label="Return to Sinop home"><img src="/sinop-mark.svg" alt=""/><strong>Sinop</strong></button><span>Secure registration · Test mode</span></header><main><aside><span>STEP 1 OF 2</span><h1>Create your Sinop account</h1><p>Register the primary account holder, choose a subscription, and test the payment confirmation flow.</p><ol><li className="active"><b>1</b><span>Registration & payment<small>Account and subscription</small></span></li><li><b>2</b><span>Agency setup<small>Branding and costing formula</small></span></li></ol><div className="test-mode-note"><b>TEST MODE</b><p>No real card payment will be charged and no receipt will be uploaded to a server.</p></div></aside><section><form className="sinop-registration-form" onSubmit={event=>{event.preventDefault();const form=new FormData(event.currentTarget);if(paymentMethod!=="stripe"&&!receiptName){setError("Attach a payment receipt before continuing.");return;}setError("");onComplete({email:String(form.get("email")),password:String(form.get("password")),firstName:String(form.get("firstName")),lastName:String(form.get("lastName")),agencyName:String(form.get("agencyName")),plan,paymentMethod,accountNumber,receiptName:receiptName||undefined})}}><div className="onboarding-heading"><span>Account credentials</span><h2>Create your secure sign-in</h2><p>Your email and password will be used to access your Sinop workspace.</p></div><label>Email Address<input type="email" name="email" required autoComplete="email" placeholder="name@agency.gov.ph"/></label><label>Password<input type="password" name="password" required minLength={8} autoComplete="new-password" placeholder="Minimum 8 characters"/><small className="field-hint">Use at least 8 characters.</small></label><div className="onboarding-divider"/><div className="onboarding-heading compact"><span>Account owner</span><h2>Tell us who is registering</h2><p>This person becomes the initial Superadmin and receives the generated Sinop account number.</p></div><div className="onboarding-grid two"><label>First Name<input name="firstName" required autoComplete="given-name" placeholder="First name"/></label><label>Last Name<input name="lastName" required autoComplete="family-name" placeholder="Last name"/></label></div><label>Agency Name<input name="agencyName" required placeholder="Official agency or organization name"/></label><div className="onboarding-divider"/><div className="onboarding-heading compact"><span>Subscription</span><h2>Select your billing term</h2></div><div className="plan-picker"><label className={plan==="Yearly"?"selected":""}><input type="radio" name="plan" checked={plan==="Yearly"} onChange={()=>setPlan("Yearly")}/><span><b>Yearly</b><small>Best value</small></span><strong>₱125,000.00<small>/ year</small></strong></label><label className={plan==="Semestral"?"selected":""}><input type="radio" name="plan" checked={plan==="Semestral"} onChange={()=>setPlan("Semestral")}/><span><b>Semestral</b><small>Shorter commitment</small></span><strong>₱68,750.00<small>/ 6 months</small></strong></label></div><div className="onboarding-divider"/><div className="onboarding-heading compact"><span>Payment option</span><h2>How will the agency pay?</h2><p>This is a simulated payment step for testing the onboarding experience.</p></div><div className="payment-picker"><label className={paymentMethod==="stripe"?"selected":""}><input type="radio" name="payment" checked={paymentMethod==="stripe"} onChange={()=>{setPaymentMethod("stripe");setError("")}}/><i>▰</i><span><b>Stripe Checkout</b><small>Credit or debit card · Test payment</small></span></label><label className={paymentMethod==="bank"?"selected":""}><input type="radio" name="payment" checked={paymentMethod==="bank"} onChange={()=>{setPaymentMethod("bank");setError("")}}/><i>₱</i><span><b>Bank payment</b><small>Deposit or electronic transfer</small></span></label><label className={paymentMethod==="check"?"selected":""}><input type="radio" name="payment" checked={paymentMethod==="check"} onChange={()=>{setPaymentMethod("check");setError("")}}/><i>✓</i><span><b>Check payment</b><small>Agency or manager’s check</small></span></label></div><div className="account-number-box"><span>Registered Account Number</span><strong>{accountNumber}</strong><small>Use this ID as the payment reference for bank or check transactions.</small></div>{paymentMethod==="stripe"?<div className="stripe-test-box"><span>STRIPE · TEST MODE</span><p>Sinop will redirect to hosted Stripe Checkout in production. For this test, clicking continue simulates a successful {price} payment.</p><div><i>VISA</i><i>Mastercard</i><i>AMEX</i></div></div>:<label className="receipt-upload">Attach payment receipt <small>Required for {paymentMethod==="bank"?"bank":"check"} payments · PDF, PNG, or JPG</small><input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={event=>{setReceiptName(event.target.files?.[0]?.name??"");setError("")}}/><span>{receiptName||"Choose receipt file"}</span></label>}{error&&<p className="onboarding-error">{error}</p>}<div className="onboarding-actions"><button type="button" className="sinop-outline" onClick={onBack}>Back</button><button className="sinop-solid">{paymentMethod==="stripe"?"Confirm test payment":"Submit payment proof"} and continue →</button></div></form></section></main></div>;
}

function SinopTrialRegistration({ initialPlan, onBack, onComplete }: { initialPlan: SubscriptionPlan; onBack: () => void; onComplete: (data: RegistrationData) => void }) {
  const [plan,setPlan]=useState<SubscriptionPlan>(initialPlan);
  const accountNumber="SNP-2026-00001";
  return <div className="sinop-onboarding-page"><header><button onClick={onBack} className="sinop-logo" aria-label="Return to Sinop home"><img src="/sinop-mark.svg" alt=""/><strong>Sinop</strong></button><span>30-day free trial · No payment required</span></header><main><aside><span>STEP 1 OF 2</span><h1>Start your 30-day free trial</h1><p>Create the Superadmin account and choose the subscription term you may use after the trial. No card, bank deposit, check, or receipt is required today.</p><ol><li className="active"><b>1</b><span>Account registration<small>Credentials and agency</small></span></li><li><b>2</b><span>Agency setup<small>Branding and costing formula</small></span></li></ol><div className="trial-note"><b>30 DAYS FREE</b><p>Explore the complete Sinop workflow before deciding whether to continue with a paid subscription.</p></div></aside><section><form className="sinop-registration-form" onSubmit={event=>{event.preventDefault();const form=new FormData(event.currentTarget);onComplete({email:String(form.get("email")),password:String(form.get("password")),firstName:String(form.get("firstName")),lastName:String(form.get("lastName")),agencyName:String(form.get("agencyName")),plan,paymentMethod:"stripe",accountNumber})}}><div className="onboarding-heading"><span>Account credentials</span><h2>Create your secure sign-in</h2><p>Your email and password will be used to access your Sinop workspace.</p></div><label>Email Address<input type="email" name="email" required autoComplete="email" placeholder="name@agency.gov.ph"/></label><label>Password<input type="password" name="password" required minLength={8} autoComplete="new-password" placeholder="Minimum 8 characters"/><small className="field-hint">Use at least eight characters.</small></label><div className="onboarding-divider"/><div className="onboarding-heading compact"><span>Superadmin account</span><h2>Tell us who is registering</h2><p>This person becomes the initial Superadmin and can create users or send registration links.</p></div><div className="onboarding-grid two"><label>First Name<input name="firstName" required autoComplete="given-name" placeholder="First name"/></label><label>Last Name<input name="lastName" required autoComplete="family-name" placeholder="Last name"/></label></div><label>Agency Name<input name="agencyName" required placeholder="Official agency or organization name"/></label><div className="account-number-box"><span>Registered Account Number</span><strong>{accountNumber}</strong><small>This permanent agency ID will be used for future subscription and support references.</small></div><div className="onboarding-divider"/><div className="onboarding-heading compact"><span>After the free trial</span><h2>Preferred subscription term</h2><p>You will not be charged during registration.</p></div><div className="plan-picker"><label className={plan==="Yearly"?"selected":""}><input type="radio" name="plan" checked={plan==="Yearly"} onChange={()=>setPlan("Yearly")}/><span><b>Yearly</b><small>Best value after trial</small></span><strong>₱125,000.00<small>/ year</small></strong></label><label className={plan==="Semestral"?"selected":""}><input type="radio" name="plan" checked={plan==="Semestral"} onChange={()=>setPlan("Semestral")}/><span><b>Semestral</b><small>Six-month term</small></span><strong>₱68,750.00<small>/ 6 months</small></strong></label></div><div className="trial-confirmation"><b>No payment information collected</b><p>Your free trial begins after agency setup. Sinop will show a reminder before the trial ends.</p></div><div className="onboarding-actions"><button type="button" className="sinop-outline" onClick={onBack}>Back</button><button className="sinop-solid">Continue to agency setup →</button></div></form></section></main></div>;
}

function SinopSetup({ registration, onFinish }: { registration: RegistrationData; onFinish: () => void }) {
  const [formula, setFormula] = useState<CostFormula | "">("");
  const [logoPreview, setLogoPreview] = useState("");
  const [headerPreview, setHeaderPreview] = useState("");
  const [error, setError] = useState("");
  return <div className="sinop-onboarding-page"><header><span className="sinop-logo"><img src="/sinop-mark.svg" alt=""/><strong>Sinop</strong></span><span>Account {registration.accountNumber}</span></header><main><aside><span>STEP 2 OF 2</span><h1>Set up your agency workspace</h1><p>Apply optional agency details, then choose the costing formula Sinop will consistently use for expendable inventory and RPCI.</p><ol><li className="done"><b>✓</b><span>Registration & payment<small>{registration.plan} · Confirmed</small></span></li><li className="active"><b>2</b><span>Agency setup<small>Branding and costing formula</small></span></li></ol></aside><section><form className="sinop-registration-form setup-form" onSubmit={event=>{event.preventDefault();if(!formula){setError("Choose FIFO or Running Average before entering the workspace.");return;}setError("");onFinish()}}><div className="onboarding-heading"><span>Agency identity · Optional</span><h2>Make the workspace yours</h2><p>These fields may be completed now or updated later from Account Settings.</p></div><label>Agency Name<input defaultValue={registration.agencyName} placeholder="Official agency name"/></label><label>Agency Address<textarea rows={3} placeholder="Complete office address"/></label><div className="onboarding-grid two"><label className="branding-upload">Agency Logo<input type="file" accept=".png,.jpg,.jpeg" onChange={event=>{const file=event.target.files?.[0];setLogoPreview(file?URL.createObjectURL(file):"")}}/><span>{logoPreview?<img src={logoPreview} alt="Agency logo preview"/>:"Upload PNG or JPG"}</span></label><label className="branding-upload">Agency Header<input type="file" accept=".png,.jpg,.jpeg" onChange={event=>{const file=event.target.files?.[0];setHeaderPreview(file?URL.createObjectURL(file):"")}}/><span>{headerPreview?<img src={headerPreview} alt="Agency header preview"/>:"Upload PNG or JPG"}</span></label></div><button type="button" className="skip-branding" onClick={()=>document.getElementById("formula-choice")?.scrollIntoView({behavior:"smooth"})}>Skip agency branding for now ↓</button><div className="onboarding-divider"/><div className="onboarding-heading" id="formula-choice"><span>Inventory costing · Mandatory</span><h2>Choose the expendable reporting formula</h2><p>Sinop must use one formula consistently because receipts may have different unit prices. Your choice controls issue valuation, running balances, Stock Cards, and the unit value and total amount shown in RPCI.</p></div><div className="formula-picker"><label className={formula==="FIFO"?"selected":""}><input required type="radio" name="formula" checked={formula==="FIFO"} onChange={()=>{setFormula("FIFO");setError("")}}/><span className="formula-icon">01</span><div><b>FIFO</b><small>First In, First Out</small><p>Issues the oldest available batch first using its actual acquisition cost. Choose this when physical stock normally moves by receipt date and you want direct batch-level traceability.</p></div><em>Recommended</em></label><label className={formula==="Running Average"?"selected":""}><input required type="radio" name="formula" checked={formula==="Running Average"} onChange={()=>{setFormula("Running Average");setError("")}}/><span className="formula-icon">∑</span><div><b>Running Average</b><small>Moving weighted-average cost</small><p>Recalculates one average unit cost after every receipt. Choose this when the agency prefers smoother valuation and consolidated costing for identical expendable items.</p></div></label></div><div className="formula-notice"><b>Why this cannot be skipped</b><p>Changing formulas after live transactions begin can alter historical inventory values. Sinop locks the selected method for consistent RPCI and stock reporting; an administrator can request a controlled migration later.</p></div>{error&&<p className="onboarding-error">{error}</p>}<div className="onboarding-actions"><span>Signed in as <b>{registration.firstName} {registration.lastName}</b></span><button className="sinop-solid">Finish setup and open Sinop →</button></div></form></section></main></div>;
}

function SinopAgencySetup({ registration, onFinish }: { registration: RegistrationData; onFinish: (theme: AgencyTheme) => void }) {
  const [agencyName,setAgencyName]=useState(registration.agencyName);
  const [agencyAddress,setAgencyAddress]=useState("");
  const [colors,setColors]=useState<string[]>(["#0F2942","#059669"]);
  const [formula,setFormula]=useState<CostFormula|"">("");
  const [logoPreview,setLogoPreview]=useState("");
  const [headerPreview,setHeaderPreview]=useState("");
  const [error,setError]=useState("");
  const previewTheme: AgencyTheme={agencyName:agencyName||registration.agencyName,agencyAddress,logoPreview,headerPreview,colors,formula:formula||"FIFO"};
  return <div className="sinop-onboarding-page"><header><span className="sinop-logo"><img src="/sinop-mark.svg" alt=""/><strong>Sinop</strong></span><span>Account {registration.accountNumber}</span></header><main><aside><span>STEP 2 OF 2</span><h1>Set up your agency workspace</h1><p>Choose the agency identity and colors that will shape the dashboard, then select the expendable costing formula.</p><ol><li className="done"><b>✓</b><span>Registration & payment<small>{registration.plan} · Confirmed</small></span></li><li className="active"><b>2</b><span>Agency setup<small>Identity, colors, and formula</small></span></li></ol><div className="test-mode-note"><b>COLOR SAFETY</b><p>Sinop automatically mixes the selected palette and protects text contrast across every dashboard screen.</p></div></aside><section><form className="sinop-registration-form setup-form" onSubmit={event=>{event.preventDefault();if(colors.length<2){setError("Choose at least two agency colors.");return}if(!formula){setError("Choose FIFO or Running Average before entering the workspace.");return}setError("");onFinish({...previewTheme,formula})}}><div className="onboarding-heading"><span>Agency identity · Optional</span><h2>Make the workspace yours</h2><p>Agency details and files may be skipped. Your two-color minimum is required and can be changed later in Admin Options → System Settings.</p></div><label>Agency Name<input value={agencyName} onChange={e=>setAgencyName(e.target.value)} placeholder="Official agency name"/></label><label>Agency Address<textarea rows={3} value={agencyAddress} onChange={e=>setAgencyAddress(e.target.value)} placeholder="Complete office address"/></label><div className="onboarding-grid two"><label className="branding-upload">Agency Logo<input type="file" accept=".png,.jpg,.jpeg" onChange={event=>{const file=event.target.files?.[0];setLogoPreview(file?URL.createObjectURL(file):"")}}/><span>{logoPreview?<img src={logoPreview} alt="Agency logo preview"/>:"Upload PNG or JPG"}</span></label><label className="branding-upload">Agency Header<input type="file" accept=".png,.jpg,.jpeg" onChange={event=>{const file=event.target.files?.[0];setHeaderPreview(file?URL.createObjectURL(file):"")}}/><span>{headerPreview?<img src={headerPreview} alt="Agency header preview"/>:"Upload PNG or JPG"}</span></label></div><div className="onboarding-divider"/><div className="onboarding-heading"><span>Agency palette · 2 required, 3 maximum</span><h2>Choose your dashboard colors</h2></div><ThemePicker colors={colors} onChange={setColors}/><div className="setup-theme-preview" style={themeVariables(previewTheme)}><span>Navigation</span><strong>{agencyName||"Your Agency"}</strong><button type="button">Sample action</button><i>Readable highlight</i></div><div className="onboarding-divider"/><div className="onboarding-heading" id="formula-choice"><span>Inventory costing · Mandatory</span><h2>Choose the expendable reporting formula</h2><p>Your choice controls issue valuation, running balances, Stock Cards, and RPCI amounts.</p></div><div className="formula-picker"><label className={formula==="FIFO"?"selected":""}><input required type="radio" name="formula" checked={formula==="FIFO"} onChange={()=>{setFormula("FIFO");setError("")}}/><span className="formula-icon">01</span><div><b>FIFO</b><small>First In, First Out</small><p>Issues the oldest available batch first using its actual acquisition cost. Best for physical batch traceability.</p></div><em>Recommended</em></label><label className={formula==="Running Average"?"selected":""}><input required type="radio" name="formula" checked={formula==="Running Average"} onChange={()=>{setFormula("Running Average");setError("")}}/><span className="formula-icon">∑</span><div><b>Running Average</b><small>Moving weighted-average cost</small><p>Recalculates one average unit cost after every receipt for consolidated costing.</p></div></label></div><div className="formula-notice"><b>Why this is mandatory</b><p>The formula keeps RPCI, Stock Cards, and issue values consistent. You can change it later in System Settings, but completed transactions will not be undone or recalculated; affected records must be recreated to use the new formula.</p></div>{error&&<p className="onboarding-error">{error}</p>}<div className="onboarding-actions"><span>Signed in as <b>{registration.firstName} {registration.lastName}</b></span><button className="sinop-solid">Finish setup and open Sinop →</button></div></form></section></main></div>;
}

function SinopLogin({ onBack, onRegister, onLogin }: { onBack: () => void; onRegister: () => void; onLogin: () => void }) {
  const [showPassword,setShowPassword]=useState(false);
  const [error,setError]=useState("");
  return <div className="sinop-login-page"><aside><button className="sinop-logo login-brand" onClick={onBack} aria-label="Return to Sinop home"><img src="/sinop-mark.svg" alt="Sinop logo"/><strong>Sinop</strong></button><div className="login-brand-copy"><span>INVENTORY AND PROPERTY MANAGEMENT</span><h1>Every public asset.<br/><em>Accounted for.</em></h1><p>One secure workspace for procurement, acceptance, inventory, issuance, property accountability, and reporting.</p></div><div className="login-flow"><span>PROCUREMENT</span><i>→</i><span>ACCEPTANCE</span><i>→</i><span>INVENTORY</span><i>→</i><span>REPORTING</span></div><small>Sinop · Built for accountable public service</small></aside><main><div className="login-card"><div className="login-mobile-brand"><img src="/sinop-mark.svg" alt="Sinop logo"/><strong>Sinop</strong></div><span className="sinop-modal-kicker">Welcome back</span><h2>Log in to your workspace</h2><p>Enter the credentials registered with your agency account.</p><form onSubmit={event=>{event.preventDefault();const form=new FormData(event.currentTarget);if(!String(form.get("email")).trim()||String(form.get("password")).length<8){setError("Enter a valid email address and a password with at least 8 characters.");return}setError("");onLogin()}}><label>Email Address<input type="email" name="email" required autoComplete="email" placeholder="name@agency.gov.ph"/></label><label>Password<div className="password-control"><input type={showPassword?"text":"password"} name="password" required minLength={8} autoComplete="current-password" placeholder="Enter your password"/><button type="button" onClick={()=>setShowPassword(value=>!value)}>{showPassword?"Hide":"Show"}</button></div></label><div className="login-options"><label><input type="checkbox"/> Keep me signed in</label><button type="button">Forgot password?</button></div>{error&&<p className="onboarding-error">{error}</p>}<button className="sinop-solid login-submit">Log in to Sinop →</button></form><div className="login-register"><span>New to Sinop?</span><button onClick={onRegister}>Create an agency account</button></div><small className="login-test-note">Test mode: any valid email and password with at least 8 characters will open the demo dashboard.</small></div></main></div>;
}

function SinopLanding({ onEnter, onRegister, onLogin }: { onEnter: () => void; onRegister: (plan: SubscriptionPlan) => void; onLogin: () => void }) {
  const [demoOpen, setDemoOpen] = useState(false);
  const features = [
    ["Procurement control", "Create purchase orders, connect suppliers, and follow every transaction from draft to completion."],
    ["Inventory that reconciles", "Accepted IARs automatically become available stock while completed RIS transactions update balances."],
    ["Property accountability", "Track semi-expendable and capital-outlay units individually, from receipt to transfer or disposal."],
    ["Government-ready forms", "Generate the required inventory, property, issuance, ledger, and physical-count reports."],
    ["Roles and approvals", "Give staff the tools to work while keeping deletion, unposting, and sensitive controls with administrators."],
    ["Your agency, your identity", "Apply your agency name, preferred color, header, signatories, employees, and master data."],
  ];

  return (
    <div className="sinop-site">
      <header className="sinop-nav">
        <a className="sinop-logo" href="#top" aria-label="Sinop home"><img src="/sinop-mark.svg" alt=""/><strong>Sinop</strong></a>
        <nav aria-label="Landing page navigation">
          <a href="#about">About</a><a href="#features">Solutions</a><a href="#workflow">How it works</a><a href="#pricing">Pricing</a>
        </nav>
        <div className="sinop-nav-actions"><button className="sinop-ghost" onClick={()=>setDemoOpen(true)}>Watch demo</button><button className="sinop-login-button" onClick={onLogin}>Log in</button><button className="sinop-solid" onClick={()=>onRegister("Yearly")}>Register</button></div>
      </header>

      <main id="top">
        <section className="sinop-hero">
          <div className="sinop-hero-copy">
            <span className="sinop-kicker">Inventory and property management, finally in order</span>
            <h1>Every public asset.<br/><em>Accounted for.</em></h1>
            <p>Sinop connects procurement, inspection, inventory, issuance, property records, and government reports in one secure workspace built for Philippine agencies.</p>
            <div className="sinop-hero-actions"><button className="sinop-solid sinop-large" onClick={()=>onRegister("Yearly")}>Start your workspace <span>→</span></button><button className="sinop-play" onClick={()=>setDemoOpen(true)}><i>▶</i><span><strong>See Sinop in action</strong><small>Watch the product tour</small></span></button></div>
            <div className="sinop-trust"><span>✓ 30-day free trial</span><span>✓ No payment required</span><span>✓ Setup assistance included</span></div>
          </div>
          <div className="sinop-product-frame" aria-label="Sinop dashboard preview">
            <div className="sinop-window-bar"><i/><i/><i/><span>app.sinop.ph</span></div>
            <div className="sinop-preview-shell">
              <aside><b><img src="/sinop-mark.svg" alt=""/></b><span className="active">⌂</span><span>PO</span><span>IA</span><span>PR</span><span>RP</span></aside>
              <div className="sinop-preview-main">
                <div className="sinop-preview-head"><div><small>INVENTORY AND PROPERTY MANAGEMENT</small><strong>Good morning, Supply Officer</strong></div><i>GS</i></div>
                <div className="sinop-preview-stats"><article><small>Active POs</small><b>24</b><em>+8 this month</em></article><article><small>Inventory value</small><b>₱22.5M</b><em>Live balance</em></article><article><small>Property units</small><b>440</b><em>100% traceable</em></article></div>
                <div className="sinop-preview-grid"><article className="chart-card"><span>Monthly inventory issuance</span><div>{[42,58,48,73,63,88,69,92,78,84].map((h,i)=><i key={i} style={{height:`${h}%`}}/>)}</div></article><article className="status-card"><span>Workflow status</span><p><b>Purchase orders</b><em>24 active</em></p><p><b>IAR processing</b><em>5 pending</em></p><p><b>RIS issuance</b><em>Up to date</em></p></article></div>
              </div>
            </div>
          </div>
        </section>

        <section className="sinop-proof"><p>One source of truth from <strong>purchase request</strong> to <strong>physical count</strong></p><div><span>PROCUREMENT</span><i>→</i><span>ACCEPTANCE</span><i>→</i><span>INVENTORY</span><i>→</i><span>ISSUANCE</span><i>→</i><span>REPORTING</span></div></section>

        <section className="sinop-about" id="about"><div className="sinop-about-intro"><span>ABOUT SINOP</span><h2>Your technology partner for accountable public assets.</h2><p>Sinop was designed around the actual documents, approvals, and accountability requirements of Philippine public offices. It gives procurement, supply, property, and management teams one organized system—from the first purchase order to the final physical count.</p></div><div className="sinop-purpose-grid"><article><span>OUR MISSION</span><h3>Make public asset management clear, connected, and dependable.</h3><p>To help Philippine public institutions manage procurement, supplies, and properties with greater accountability, accurate records, and less administrative friction.</p></article><article><span>OUR VISION</span><h3>Every government asset visible. Every movement traceable.</h3><p>We envision public offices where trustworthy information supports faster decisions, responsible stewardship, and better service to every Filipino.</p></article></div><div className="sinop-about-stats"><article><strong>1</strong><span>Connected operational record</span><p>Procurement, acceptance, inventory, issuance, and property records stay linked.</p></article><article><strong>30+</strong><span>Ready government forms</span><p>Generate working documents and consolidated reports from the same data.</p></article><article><strong>100%</strong><span>Agency-ready identity</span><p>Use your own office name, color, header, employees, and approval structure.</p></article></div></section>

        <section className="sinop-section" id="features"><div className="sinop-section-heading"><span>WHY SINOP?</span><h2>Built around the way your agency actually works</h2><p>Replace scattered spreadsheets and disconnected forms with a complete, accountable operational flow.</p></div><div className="sinop-feature-grid">{features.map((feature,index)=><article key={feature[0]}><i>{String(index+1).padStart(2,"0")}</i><h3>{feature[0]}</h3><p>{feature[1]}</p><span>Learn more →</span></article>)}</div></section>

        <section className="sinop-workflow" id="workflow"><div><span>From delivery to accountability</span><h2>A clear record at every step</h2><p>Sinop keeps documents, quantities, accountable officers, and running balances connected—so your team can trace exactly what happened and when.</p><ul><li><b>01</b> Complete a purchase order</li><li><b>02</b> Inspect and accept the delivery</li><li><b>03</b> Create stock batches or individual property units</li><li><b>04</b> Issue, transfer, monitor, and report</li></ul></div><div className="sinop-flow-card"><span>LIVE WORKFLOW</span><article><i>PO</i><p><strong>Purchase Order</strong><small>Approved · ₱284,500</small></p><b>✓</b></article><em/><article><i>IA</i><p><strong>Inspection & Acceptance</strong><small>20 units accepted</small></p><b>✓</b></article><em/><article><i>PR</i><p><strong>Property Records</strong><small>20 accountable units created</small></p><b>20</b></article></div></section>

        <section className="sinop-pricing sinop-section" id="pricing"><div className="sinop-section-heading"><span>Simple agency pricing</span><h2>Choose the commitment that fits your rollout</h2><p>Start with the complete platform free for 30 days. No payment details are collected during registration.</p></div><div className="sinop-pricing-grid"><article><span>Semestral</span><h3>₱68,750.00<small>/ 6 months</small></h3><p>Half of the annual price plus a 10% semestral service adjustment.</p><ul><li>30-day free trial first</li><li>Up to 10 authorized users</li><li>Unlimited viewer access</li><li>All inventory and property modules</li><li>Government forms and reports</li></ul><button className="sinop-outline" onClick={()=>onRegister("Semestral")}>Start 30-day free trial</button></article><article className="featured"><b>BEST VALUE</b><span>Yearly</span><h3>₱125,000.00<small>/ year</small></h3><p>Best value for continuous operations, support, and annual reporting.</p><ul><li>30-day free trial first</li><li>Everything in the semestral plan</li><li>Save ₱12,500 versus two semestral terms</li><li>Priority setup assistance</li><li>Annual data-health review</li></ul><button className="sinop-solid" onClick={()=>onRegister("Yearly")}>Start 30-day free trial</button></article><article><span>Customized</span><h3>Let’s talk</h3><p>For larger offices, special workflows, migration, or additional services.</p><ul><li>Custom user requirements</li><li>Data migration assistance</li><li>Agency-specific workflow changes</li><li>Additional reports or integrations</li><li>Dedicated rollout planning</li></ul><a className="sinop-outline" href="mailto:sales@sinop.app?subject=Customized%20Sinop%20quotation">Email for a quotation</a></article></div><small className="sinop-pricing-note">Prices shown are introductory and may be adjusted based on final deployment requirements.</small></section>

        <section className="sinop-cta"><div><span>Ready to put every record in order?</span><h2>Start building your agency workspace today.</h2></div><button className="sinop-light" onClick={()=>onRegister("Yearly")}>Register for free trial →</button></section>
      </main>

      <footer className="sinop-footer"><a className="sinop-logo" href="#top"><img src="/sinop-mark.svg" alt=""/><strong>Sinop</strong></a><p>Inventory and property management for accountable public service.</p><div><a href="#features">Features</a><a href="#pricing">Pricing</a><a href="mailto:sales@sinop.app">Contact</a></div><small>© 2026 Sinop. All rights reserved.</small></footer>

      {demoOpen&&<div className="sinop-modal sinop-demo-modal" role="dialog" aria-modal="true" aria-labelledby="demo-title"><div><button type="button" className="sinop-close" onClick={()=>setDemoOpen(false)} aria-label="Close demo">×</button><span className="sinop-modal-kicker">Product tour</span><h2 id="demo-title">See how Sinop keeps every movement connected</h2><div className="sinop-demo-screen"><span>DEMO PREVIEW</span><div className="sinop-demo-flow"><i>PO</i><b>→</b><i>IAR</i><b>→</b><i>STOCK</i><b>→</b><i>RIS</i><b>→</b><i>REPORTS</i></div><p>From approved procurement to live inventory balances and accountable property records.</p><em><i/></em></div><p className="sinop-demo-caption">This interactive preview is ready to be replaced by the final Sinop walkthrough video.</p><button className="sinop-solid sinop-full" onClick={()=>{setDemoOpen(false);onEnter()}}>Explore the working demo</button></div></div>}
    </div>
  );
}

type WorkspaceAdminSection = "Users" | "Activity Log" | "Employees" | "Plantilla" | "Division" | "UOM" | "Procurement Modes" | "UACS" | "System Settings";
type MasterLists = { Division: string[]; UOM: string[]; "Procurement Modes": string[]; UACS: string[] };

function SinopDashboard({ users, theme, onAdmin }: { users: WorkspaceUser[]; theme: AgencyTheme; onAdmin: () => void }) {
  const [year,setYear]=useState(String(new Date().getFullYear()));
  const [phNow,setPhNow]=useState(new Date());
  useEffect(()=>{const timer=window.setInterval(()=>setPhNow(new Date()),1000);return()=>window.clearInterval(timer)},[]);
  const activeUsers=Math.max(1,users.filter(user=>user.status==="Active").length+1);
  const phDate=new Intl.DateTimeFormat("en-PH",{timeZone:"Asia/Manila",weekday:"long",month:"long",day:"numeric",year:"numeric"}).format(phNow);
  const phTime=new Intl.DateTimeFormat("en-PH",{timeZone:"Asia/Manila",hour:"numeric",minute:"2-digit",second:"2-digit"}).format(phNow);
  const lowStock=[["A4 Copy Paper","12 reams","Reorder at 20"],["Printer Ink, Black","6 bottles","Reorder at 10"],["Alcohol, 500ml","9 bottles","Reorder at 16"],["Legal-size Folder","18 pcs","Reorder at 30"]];
  return <><section className="workspace-dashboard-head"><div><span>INVENTORY AND PROPERTY MANAGEMENT</span><h2>Good day, {theme.agencyName}</h2><p>A live operational view of your registered users, inventory movement, and stock alerts.</p></div><div className="dashboard-year"><label>Reporting Period<select value={year} onChange={e=>setYear(e.target.value)}>{Array.from({length:6},(_,index)=>String(new Date().getFullYear()-3+index)).map(value=><option key={value}>{value}</option>)}</select></label></div></section><section className="workspace-live-grid"><article className="live-card users"><div><span>ACTIVE REGISTERED USERS</span><strong>{activeUsers}</strong><p>Users currently enabled in this workspace</p></div><button onClick={onAdmin}>Manage users →</button></article><article className="live-card clock"><span>PHILIPPINE STANDARD TIME</span><strong>{phTime}</strong><p>{phDate}</p><small>Asia/Manila · UTC+8</small></article><article className="live-card period"><span>REPORTING PERIOD</span><strong>{year}</strong><p>All dashboard summaries follow the selected year.</p></article></section><section className="running-inventory"><div className="dashboard-section-title"><div><span>RUNNING INVENTORY</span><h3>Live inventory position</h3></div><small>Updated from completed acceptance and issuance transactions</small></div><div className="running-metrics"><article><span>Expendable on hand</span><strong>4,286</strong><small>₱864,320 current value</small><i style={{width:"76%"}}/></article><article><span>Semi-expendable units</span><strong>314</strong><small>298 issued · 16 available</small><i style={{width:"64%"}}/></article><article><span>Capital outlay units</span><strong>126</strong><small>₱18.76M acquisition value</small><i style={{width:"88%"}}/></article><article><span>Issues this year</span><strong>1,284</strong><small>{year} completed RIS quantities</small><i style={{width:"53%"}}/></article></div></section><section className="dashboard-monitor-grid"><article className="running-inventory movement-panel"><div className="dashboard-section-title"><div><span>INVENTORY MOVEMENT</span><h3>Monthly running activity · {year}</h3></div></div><div className="movement-chart">{[42,58,48,73,63,88,69,92,78,84,67,75].map((height,index)=><div key={index}><i style={{height:`${height}%`}}/><span>{["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][index]}</span></div>)}</div></article><article className="running-inventory low-watch"><div className="dashboard-section-title"><div><span>LOW STOCK WATCH</span><h3>Items requiring attention</h3></div><b>{lowStock.length}</b></div><div>{lowStock.map((item,index)=><article key={item[0]}><span>{String(index+1).padStart(2,"0")}</span><p><strong>{item[0]}</strong><small>{item[1]} · {item[2]}</small></p><em>Low</em></article>)}</div></article></section></>;
}

function SinopAdmin({ theme,setTheme,section,setSection,employees,setEmployees,plantilla,setPlantilla,users,setUsers,masters,setMasters }: { theme:AgencyTheme;setTheme:(theme:AgencyTheme)=>void;section:WorkspaceAdminSection;setSection:(section:WorkspaceAdminSection)=>void;employees:EmployeeRecord[];setEmployees:(rows:EmployeeRecord[])=>void;plantilla:PlantillaRecord[];setPlantilla:(rows:PlantillaRecord[])=>void;users:WorkspaceUser[];setUsers:(rows:WorkspaceUser[])=>void;masters:MasterLists;setMasters:(lists:MasterLists)=>void }) {
  const [entry,setEntry]=useState(""); const [detail,setDetail]=useState(""); const [email,setEmail]=useState(""); const [role,setRole]=useState<UserRole>("Staff"); const [inviteLink,setInviteLink]=useState(""); const [selectedEmployee,setSelectedEmployee]=useState(""); const [selectedPosition,setSelectedPosition]=useState("");
  const sections:WorkspaceAdminSection[]=["Users","Activity Log","Employees","Plantilla","Division","UOM","Procurement Modes","UACS","System Settings"];
  const addMaster=(key:keyof MasterLists)=>{const value=entry.trim();if(!value)return;setMasters({...masters,[key]:[...masters[key],value]});setEntry("")};
  const accessMastersReady=employees.length>0&&plantilla.length>0;
  return <><section className="page-heading"><div><h2>Admin Options</h2><p>Manage users, master data, audit visibility, and agency-wide system settings.</p></div><span className="superadmin-chip">SUPERADMIN</span></section><div className="admin-column-tabs" role="tablist">{sections.map(item=><button key={item} role="tab" aria-selected={section===item} className={section===item?"active":""} onClick={()=>{setSection(item);setEntry("");setDetail("")}}>{item}{item==="Activity Log"&&<small>Private</small>}</button>)}</div>
  {section==="Users"&&<>{!accessMastersReady&&<section className="role-prerequisite"><b>Roles are locked</b><p>Create at least one record in both <button onClick={()=>setSection("Employees")}>Employees</button> and <button onClick={()=>setSection("Plantilla")}>Plantilla</button> before creating accounts or assigning roles.</p><div><span className={employees.length?"done":""}>{employees.length?"✓":"1"} Employee master list</span><span className={plantilla.length?"done":""}>{plantilla.length?"✓":"2"} Plantilla master list</span></div></section>}<section className={`account-methods ${!accessMastersReady?"locked":""}`}><article className="panel admin-entry"><div className="panel-heading"><div><h3>Create user account</h3><p>Select a registered employee and plantilla position before assigning access.</p></div></div><form onSubmit={event=>{event.preventDefault();if(!accessMastersReady||!selectedEmployee||!selectedPosition||!email.trim())return;setUsers([...users,{id:Date.now(),name:selectedEmployee,email:email.trim(),role,status:"Active",employee:selectedEmployee,position:selectedPosition}]);setEmail("");setSelectedEmployee("");setSelectedPosition("")}}><label>Employee<select disabled={!accessMastersReady} value={selectedEmployee} onChange={e=>setSelectedEmployee(e.target.value)} required><option value="">Select from Employee master list</option>{employees.map(row=><option key={row.id}>{row.name}</option>)}</select></label><label>Plantilla Position<select disabled={!accessMastersReady} value={selectedPosition} onChange={e=>setSelectedPosition(e.target.value)} required><option value="">Select from Plantilla master list</option>{plantilla.map(row=><option key={row.id}>{row.title}</option>)}</select></label><label>Email Address<input disabled={!accessMastersReady} type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="name@agency.gov.ph"/></label><label>Role<select disabled={!accessMastersReady} value={role} onChange={e=>setRole(e.target.value as UserRole)}><option>Superadmin</option><option>Admin</option><option>Staff</option><option>Viewer</option></select></label><button disabled={!accessMastersReady} className="primary-button">Create user and assign role</button></form></article><article className="panel admin-entry"><div className="panel-heading"><div><h3>Registration link</h3><p>Self-registration is unlocked after Employee and Plantilla masters are ready.</p></div></div><form onSubmit={event=>{event.preventDefault();if(!accessMastersReady)return;setInviteLink(`https://app.sinop.ph/register/${registrationAccount(theme.agencyName)}?invite=${Math.random().toString(36).slice(2,10).toUpperCase()}`)}}><button disabled={!accessMastersReady} className="secondary-button">Generate registration link</button>{inviteLink&&<div className="invite-link-box"><input readOnly value={inviteLink}/><button type="button" className="primary-button" onClick={()=>navigator.clipboard?.writeText(inviteLink)}>Copy link</button></div>}</form></article></section><section className="panel user-role-panel"><div className="panel-heading"><div><h3>Registered users</h3><p>{users.length+1} active account{users.length?"s":""}, including the registered account owner.</p></div></div><div className="table-wrap"><table><thead><tr><th>User / Employee</th><th>Plantilla</th><th>Email</th><th>Status</th><th>Role</th></tr></thead><tbody><tr><td><strong>Registered Account Owner</strong><small>Initial registration</small></td><td>Account owner</td><td>Primary registered email</td><td><Badge value="Active"/></td><td><strong>Superadmin</strong><small>Automatic · Cannot be removed here</small></td></tr>{users.map(user=><tr key={user.id}><td><strong>{user.name}</strong></td><td>{user.position||"—"}</td><td>{user.email}</td><td><Badge value={user.status}/></td><td><select disabled={!accessMastersReady} value={user.role} onChange={e=>setUsers(users.map(row=>row.id===user.id?{...row,role:e.target.value as UserRole}:row))}><option>Superadmin</option><option>Admin</option><option>Staff</option><option>Viewer</option></select></td></tr>)}</tbody></table></div></section></>}
  {section==="Activity Log"&&<section className="panel activity-log-panel"><div className="panel-heading"><div><h3>Activity Log</h3><p>Visible only to Superadmins. Records sensitive account and configuration activity.</p></div><span className="superadmin-chip">SUPERADMIN ONLY</span></div><div className="activity-timeline">{[["Account owner signed in","Authentication","Today · 9:42 AM"],["Agency colors updated","System Settings","Yesterday · 4:18 PM"],["Workspace trial activated","Registration","August 30, 2026 · 10:05 AM"],["Inventory costing formula selected",theme.formula,"August 30, 2026 · 10:02 AM"]].map((row,index)=><article key={row[0]}><b>{String(index+1).padStart(2,"0")}</b><p><strong>{row[0]}</strong><small>{row[1]}</small></p><time>{row[2]}</time></article>)}</div></section>}
  {section==="Employees"&&<section className="admin-master-grid"><article className="panel admin-entry"><div className="panel-heading"><div><h3>Add employee</h3><p>Create an employee master record.</p></div></div><form onSubmit={event=>{event.preventDefault();if(!entry.trim())return;setEmployees([...employees,{id:Date.now(),name:entry.trim()}]);setEntry("")}}><label>Employee Name<input value={entry} onChange={e=>setEntry(e.target.value)} required placeholder="Complete name"/></label><button className="primary-button">Add employee</button></form></article><MasterList title="Employees" rows={employees.map(row=>row.name)}/></section>}
  {section==="Plantilla"&&<section className="admin-master-grid"><article className="panel admin-entry"><div className="panel-heading"><div><h3>Add plantilla position</h3><p>Maintain the authorized position list.</p></div></div><form onSubmit={event=>{event.preventDefault();if(!entry.trim())return;setPlantilla([...plantilla,{id:Date.now(),title:entry.trim()}]);setEntry("")}}><label>Position Title<input value={entry} onChange={e=>setEntry(e.target.value)} required placeholder="e.g. Administrative Officer V"/></label><button className="primary-button">Add position</button></form></article><MasterList title="Plantilla" rows={plantilla.map(row=>row.title)}/></section>}
  {(section==="Division"||section==="UOM"||section==="Procurement Modes"||section==="UACS")&&<section className="admin-master-grid"><article className="panel admin-entry"><div className="panel-heading"><div><h3>Add {section}</h3><p>Maintain reusable {section.toLowerCase()} master data.</p></div></div><form onSubmit={event=>{event.preventDefault();addMaster(section)}}><label>{section==="UOM"?"UOM Name / Abbreviation":section==="UACS"?"UACS Account / Code":`${section} Name`}<input value={entry} onChange={e=>setEntry(e.target.value)} required placeholder={`Enter ${section.toLowerCase()}`}/></label>{section==="UACS"&&<label>Optional Description<input value={detail} onChange={e=>setDetail(e.target.value)} placeholder="Classification or account title"/></label>}<button className="primary-button">Add {section}</button></form></article><MasterList title={section} rows={masters[section]}/></section>}
  {section==="System Settings"&&<section className="system-settings-grid"><article className="panel branding-settings"><div className="panel-heading"><div><h3>Agency dashboard colors</h3><p>Use two required colors and an optional third. Only these colors and neutral readable shades are used.</p></div></div><ThemePicker colors={theme.colors} onChange={colors=>setTheme({...theme,colors})}/></article><article className="panel system-summary"><div className="panel-heading"><div><h3>Inventory formula</h3><p>Current expendable costing rule</p></div></div><strong>{theme.formula}</strong><p>Changes after live transactions require a controlled data migration to protect historical values.</p></article></section>}</>;
}

function MasterList({title,rows}:{title:string;rows:string[]}){return <article className="panel"><div className="panel-heading"><div><h3>{title}</h3><p>{rows.length} record{rows.length===1?"":"s"}</p></div></div>{rows.length?<div className="simple-master-list">{rows.map((row,index)=><div key={`${row}-${index}`}><span className="master-avatar">{String(index+1).padStart(2,"0")}</span><strong>{row}</strong><Badge value="Active"/></div>)}</div>:<div className="master-empty"><b>＋</b><p>No records yet.<small>Add the first entry using the form.</small></p></div>}</article>}

type UacsRecord={code:string;title:string;classification:Classification;subMajor:string;glAccount:string;active:boolean};
const officialUacs:UacsRecord[]=[
  ["1040501000","Semi-Expendable Machinery","Semi-Expendable","05","01"],["1040502000","Semi-Expendable Office Equipment","Semi-Expendable","05","02"],["1040503000","Semi-Expendable Information and Communications Technology Equipment ICT","Semi-Expendable","05","03"],["1040507000","Semi-Expendable Communications Equipment","Semi-Expendable","05","07"],["1040510000","Semi-Expendable Medical Equipment","Semi-Expendable","51","10"],["1040512000","Semi-Expendable Sports Equipment","Semi-Expendable","51","12"],["1040513000","Semi-Expendable Technical and Scientific Equipment","Semi-Expendable","51","13"],["1040519000","Semi-Expendable Other Machinery and Equipment","Semi-Expendable","51","19"],["1040601000","Semi-Expendable Furniture and Fixtures","Semi-Expendable","60","01"],["1040602000","Semi-Expendable Books","Semi-Expendable","60","02"],
  ["1060101000","Land","Capital Outlay","01","01"],["1060401000","Buildings","Capital Outlay","04","01"],["1060501000","Machinery","Capital Outlay","05","01"],["1060502000","Office Equipment","Capital Outlay","05","02"],["1060503000","Information and Communications Technology Equipment","Capital Outlay","05","03"],["1060514000","Technical and Scientific Equipment","Capital Outlay","05","14"],["1060513000","Sports Equipment","Capital Outlay","05","13"],["1060511000","Medical Equipment","Capital Outlay","05","11"],["1060512000","Printing Equipment","Capital Outlay","05","12"],["1080102000","Computer Software","Capital Outlay","01","02"],["1060599000","Other Machinery and Equipment","Capital Outlay","05","99"],["1060601000","Motor Vehicles","Capital Outlay","06","01"],["1060701000","Furniture and Fixtures","Capital Outlay","07","01"],["1060702000","Books","Capital Outlay","07","02"],["1069899000","Other Property, Plant and Equipment","Capital Outlay","98","99"]
].map(([code,title,classification,subMajor,glAccount])=>({code,title,classification:classification as Classification,subMajor,glAccount,active:true}));

type SinopAdminTab="Activity Log"|"Users"|"Plantilla"|"Employees"|"Division"|"UOM"|"UACS"|"System Settings";

function SinopDashboardUpdated({users,theme,onAdmin,transfer}:{users:WorkspaceUser[];theme:AgencyTheme;onAdmin:()=>void;transfer:DmwTransferData|null}){
  const [year,setYear]=useState(String(new Date().getFullYear()));
  const [phNow,setPhNow]=useState(new Date());
  const [stockQuery,setStockQuery]=useState("");
  useEffect(()=>{const timer=window.setInterval(()=>setPhNow(new Date()),1000);return()=>window.clearInterval(timer)},[]);
  const activeUsers=Math.max(1,users.filter(user=>user.status==="Active").length+1);
  const phDate=new Intl.DateTimeFormat("en-PH",{timeZone:"Asia/Manila",weekday:"long",month:"long",day:"numeric",year:"numeric"}).format(phNow);
  const phTime=new Intl.DateTimeFormat("en-PH",{timeZone:"Asia/Manila",hour:"numeric",minute:"2-digit",second:"2-digit"}).format(phNow);
  const data=transfer?.data;
  const categories=rowsById(data?.item_categories); const uacs=rowsById(data?.uacs_accounts);
  const movements=data?.stock_movements??[]; const batches=data?.inventory_batches??[];
  const stockRows=(data?.items??[]).filter(item=>textValue(categories.get(textValue(item,"category_id")),"default_classification")==="Expendable"||textValue(item,"default_classification")==="Expendable").map(item=>{
    const itemId=textValue(item,"id"); const itemMovements=movements.filter(row=>textValue(row,"item_id")===itemId); const itemBatches=batches.filter(row=>textValue(row,"item_id")===itemId&&textValue(row,"status")!=="Cancelled");
    const inQty=itemMovements.reduce((sum,row)=>sum+numberValue(row,"quantity_received"),0)||itemBatches.reduce((sum,row)=>sum+numberValue(row,"quantity_received"),0);
    const outQty=itemMovements.reduce((sum,row)=>sum+numberValue(row,"quantity_issued"),0);
    const balance=itemBatches.reduce((sum,row)=>sum+numberValue(row,"quantity_remaining"),0);
    const ris=[...new Set(itemMovements.filter(row=>numberValue(row,"quantity_issued")>0).map(row=>textValue(row,"reference_number")).filter(Boolean))].join(", ");
    return {item:textValue(item,"item_name"),stock:textValue(item,"item_code"),uacs:textValue(uacs.get(textValue(item,"default_uacs_account_id")),"uacs_code"),unit:textValue(item,"unit_of_measure"),inQty,outQty,balance,ris,reorder:numberValue(item,"reorder_level")};
  }).sort((a,b)=>a.item.localeCompare(b.item));
  const filtered=stockRows.filter(row=>`${row.item} ${row.stock}`.toLowerCase().includes(stockQuery.toLowerCase()));
  return <>
    <section className="workspace-dashboard-head"><div><span>INVENTORY AND PROPERTY MANAGEMENT</span><h2>Good day, {theme.agencyName}</h2><p>Live user access, reporting period, stock movement, and reorder monitoring.</p></div><div className="dashboard-year"><label>Reporting Period<select value={year} onChange={e=>setYear(e.target.value)}>{Array.from({length:6},(_,index)=>String(new Date().getFullYear()-3+index)).map(value=><option key={value}>{value}</option>)}</select></label></div></section>
    <section className="workspace-live-grid"><article className="live-card users"><div><span>ACTIVE REGISTERED USERS</span><strong>{activeUsers}</strong><p>Enabled accounts in this workspace</p></div><button onClick={onAdmin}>Manage users →</button></article><article className="live-card clock"><span>PHILIPPINE STANDARD TIME</span><strong>{phTime}</strong><p>{phDate}</p><small>Asia/Manila · UTC+8</small></article><article className="live-card period"><span>REPORTING PERIOD</span><strong>{year}</strong><p>Applied to dashboard summaries and reports.</p></article></section>
    <section className="stocks-monitor panel"><div className="stocks-monitor-head"><div><span>STOCKS LIVE MONITORING</span><h3>Expendable Inventory Balance</h3><p>In quantities come from completed IARs. Out quantities come from completed RIS transactions.</p></div><b>{filtered.length} items</b></div><div className="inventory-item-search-row"><label className="search">⌕<input value={stockQuery} onChange={e=>setStockQuery(e.target.value)} placeholder="Search existing item name or stock number…"/></label><span>Expendable items only · A–Z</span></div><div className="table-wrap"><table className="data-table stock-live-table"><thead><tr><th>Item</th><th>Stock Number</th><th>UACS</th><th>Unit</th><th>In</th><th>Out</th><th>Balance</th><th>Completed RIS Source</th><th>Status</th><th>Stock Card</th></tr></thead><tbody>{filtered.map(row=><tr key={row.stock}><td><strong>{row.item}</strong></td><td>{row.stock}</td><td><span className="class-tag">{row.uacs||"—"}</span></td><td>{row.unit}</td><td><strong className="movement-in">{number.format(row.inQty)}</strong></td><td><strong className="movement-out">{number.format(row.outQty)}</strong></td><td><strong>{number.format(row.balance)}</strong></td><td>{row.ris||"—"}</td><td><Badge value={row.balance<=row.reorder?"Low stock":"Active"}/></td><td><button className="text-button" onClick={()=>tell(`STOCK CARD\n${row.item}\nStock No.: ${row.stock}\nUACS: ${row.uacs||"—"}\nIn: ${number.format(row.inQty)}\nOut: ${number.format(row.outQty)}\nBalance: ${number.format(row.balance)}\nRIS source: ${row.ris||"None"}`)}>View Stock Card</button></td></tr>)}{!filtered.length&&<tr><td colSpan={10}><div className="master-empty"><b>⌕</b><p>No existing item found.<small>Search using the item name or stock number.</small></p></div></td></tr>}</tbody></table></div></section>
    <section className="low-stock-watch panel"><div className="panel-heading"><div><h3>Low Stock Watch</h3><p>Items at or below their reorder point.</p></div><span className="count-pill">{stockRows.filter(row=>row.balance<=row.reorder).length} items</span></div><div className="low-stock-grid">{stockRows.filter(row=>row.balance<=row.reorder).slice(0,8).map(row=><article key={row.stock}><span>{row.item.slice(0,2).toUpperCase()}</span><p><strong>{row.item}</strong><small>{number.format(row.balance)} {row.unit.toLowerCase()} remaining · reorder at {number.format(row.reorder)}</small></p><i style={{width:`${Math.max(8,row.inQty?row.balance/row.inQty*100:8)}%`}}/></article>)}</div></section>
  </>;
}

function FormsLibrary(){const [selected,setSelected]=useState<string[]|null>(null);const forms=[["RIS","Requisition and Issue Slip"],["RSMI","Report of Supplies and Materials Issued"],["SC","Appendix 58 · Stock Card"],["ICS","Appendix 59 · Inventory Custodian Slip"],["PC","Appendix 69 · Property Card"],["PPELC","Appendix 70 · PPE Ledger Card"],["PAR","Appendix 71 · Property Acknowledgement Receipt"],["PTR","Appendix 76 · Property Transfer Report"]];return <><section className="page-heading"><div><h2>Forms</h2><p>Open official inventory and property forms using saved records.</p></div></section><section className="report-grid forms-grid">{forms.map(form=><article className="report-card" key={form[0]}><span>{form[0]}</span><div><h3>{form[1]}</h3><p>Prepare this form from eligible transactions and master records.</p><small>Agency-ready form</small></div><button onClick={()=>setSelected(form)}>Open form →</button></article>)}</section>{selected&&<div className="modal-backdrop"><section className="form-preview-modal"><div className="drawer-head"><div><p>{selected[0]}</p><h2>{selected[1]}</h2></div><button onClick={()=>setSelected(null)} aria-label="Close form preview">×</button></div><div className="official-form-preview"><span>SINOP OFFICIAL FORM</span><h2>{selected[1]}</h2><p>Select eligible saved records when generating the final form. The print action uses a clean white output.</p></div><div className="drawer-foot"><button className="secondary-button" onClick={()=>setSelected(null)}>Close</button><button className="primary-button" onClick={()=>window.print()}>Print form</button></div></section></div>}</>}

function SinopAdminUpdated({theme,setTheme,section,setSection,employees,setEmployees,plantilla,setPlantilla,users,setUsers,masters,setMasters,uacs,setUacs}:{theme:AgencyTheme;setTheme:(theme:AgencyTheme)=>void;section:SinopAdminTab;setSection:(section:SinopAdminTab)=>void;employees:EmployeeRecord[];setEmployees:(rows:EmployeeRecord[])=>void;plantilla:PlantillaRecord[];setPlantilla:(rows:PlantillaRecord[])=>void;users:WorkspaceUser[];setUsers:(rows:WorkspaceUser[])=>void;masters:MasterLists;setMasters:(lists:MasterLists)=>void;uacs:UacsRecord[];setUacs:(rows:UacsRecord[])=>void}){
  const tabs:SinopAdminTab[]=["Activity Log","Users","Plantilla","Employees","Division","UOM","UACS","System Settings"];
  const [query,setQuery]=useState(""); const [name,setName]=useState(""); const [position,setPosition]=useState(""); const [email,setEmail]=useState(""); const [role,setRole]=useState<UserRole>("Staff"); const [inviteLink,setInviteLink]=useState(""); const [uacsDraft,setUacsDraft]=useState({code:"",title:"",classification:"Expendable" as Classification,subMajor:"",glAccount:""}); const [formulaNotice,setFormulaNotice]=useState(false);
  const ready=employees.length>0&&plantilla.length>0;
  const filteredEmployees=employees.filter(row=>`${row.name} ${row.position||""}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>a.name.localeCompare(b.name));
  const filteredUacs=uacs.filter(row=>`${row.code} ${row.title} ${row.classification}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>["Expendable","Semi-Expendable","Capital Outlay"].indexOf(a.classification)-["Expendable","Semi-Expendable","Capital Outlay"].indexOf(b.classification)||a.title.localeCompare(b.title));
  return <><section className="page-heading"><div><h2>Admin Options</h2><p>Maintain users, employees, positions, organizational masters, UACS accounts, and system rules.</p></div><span className="superadmin-chip">SUPERADMIN</span></section><div className="admin-column-tabs">{tabs.map(tab=><button key={tab} className={section===tab?"active":""} onClick={()=>{setSection(tab);setQuery("")}}>{tab}{tab==="Activity Log"&&<small>Private</small>}</button>)}</div>
  {section==="Activity Log"&&<section className="panel activity-log-panel"><div className="panel-heading"><div><h3>Activity Log</h3><p>Protected audit history visible only to the Superadmin.</p></div><span className="superadmin-chip">SUPERADMIN ONLY</span></div><div className="activity-timeline">{[["Account owner signed in","Authentication","Today · 9:42 AM"],["Agency palette updated","System Settings","Yesterday · 4:18 PM"],["30-day trial activated","Registration","August 30, 2026 · 10:05 AM"],[`Costing formula set to ${theme.formula}`,"Inventory Settings","August 30, 2026 · 10:02 AM"]].map((row,index)=><article key={row[0]}><b>{String(index+1).padStart(2,"0")}</b><p><strong>{row[0]}</strong><small>{row[1]}</small></p><time>{row[2]}</time></article>)}</div></section>}
  {section==="Users"&&<><section className={`role-prerequisite ${ready?"ready":""}`}><b>{ready?"Employee and Plantilla masters are ready":"Role assignment is locked"}</b><p>The registered account owner is automatically the first Superadmin. Additional roles require both an Employee and Plantilla record.</p><div><button onClick={()=>setSection("Employees")}>{employees.length?"✓":"1"} Employees</button><button onClick={()=>setSection("Plantilla")}>{plantilla.length?"✓":"2"} Plantilla</button></div></section><section className="panel user-role-panel"><div className="panel-heading"><div><h3>Registered Users</h3><p>Create accounts from the Employee master list and assign access roles.</p></div></div><form className="inline-user-form" onSubmit={event=>{event.preventDefault();if(!ready||!name||!email)return;const employee=employees.find(row=>row.name===name);setUsers([...users,{id:Date.now(),name,email,role,status:"Active",employee:name,position:employee?.position}]);setName("");setEmail("")}}><label>Employee<select disabled={!ready} value={name} onChange={e=>setName(e.target.value)} required><option value="">Select employee</option>{employees.map(row=><option key={row.id}>{row.name}</option>)}</select></label><label>Email<input disabled={!ready} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@agency.gov.ph" required/></label><label>Role<select disabled={!ready} value={role} onChange={e=>setRole(e.target.value as UserRole)}><option>Superadmin</option><option>Admin</option><option>Staff</option><option>Viewer</option></select></label><button disabled={!ready} className="primary-button">Create account</button><button disabled={!ready} type="button" className="secondary-button" onClick={()=>setInviteLink(`https://app.sinop.ph/register/${registrationAccount(theme.agencyName)}?invite=${Math.random().toString(36).slice(2,10).toUpperCase()}`)}>Generate registration link</button></form>{inviteLink&&<div className="invite-link-box user-invite"><input readOnly value={inviteLink}/><button className="primary-button" onClick={()=>navigator.clipboard?.writeText(inviteLink)}>Copy link</button></div>}<div className="table-wrap"><table className="data-table"><thead><tr><th>User</th><th>Current Position</th><th>Email</th><th>Status</th><th>Role</th></tr></thead><tbody><tr><td><strong>Registered Account Owner</strong><small>Initial registration</small></td><td>Agency account owner</td><td>Primary registered email</td><td><Badge value="Active"/></td><td><strong>Superadmin</strong></td></tr>{users.map(user=><tr key={user.id}><td><strong>{user.name}</strong></td><td>{user.position||"—"}</td><td>{user.email}</td><td><Badge value={user.status}/></td><td><select value={user.role} onChange={e=>setUsers(users.map(row=>row.id===user.id?{...row,role:e.target.value as UserRole}:row))}><option>Superadmin</option><option>Admin</option><option>Staff</option><option>Viewer</option></select></td></tr>)}</tbody></table></div></section></>}
  {section==="Plantilla"&&<section className="master-home"><div className="master-home-toolbar"><label className="search">⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search positions…"/></label><form onSubmit={event=>{event.preventDefault();if(!name.trim())return;setPlantilla([...plantilla,{id:Date.now(),title:name.trim()}]);setName("")}}><input value={name} onChange={e=>setName(e.target.value)} placeholder="Position title" required/><button className="primary-button">＋ Add position</button></form></div><section className="panel"><div className="table-wrap"><table className="data-table"><thead><tr><th>Position</th><th>Status</th><th>Action</th></tr></thead><tbody>{plantilla.filter(row=>row.title.toLowerCase().includes(query.toLowerCase())).map(row=><tr key={row.id}><td><strong>{row.title}</strong></td><td><Badge value="Active"/></td><td><button className="text-button" onClick={()=>{const next=window.prompt("Edit position title",row.title)?.trim();if(next)setPlantilla(plantilla.map(item=>item.id===row.id?{...item,title:next}:item))}}>Edit</button></td></tr>)}</tbody></table></div></section></section>}
  {section==="Employees"&&<section className="employee-home"><section className="employee-overview"><article><span>EM</span><p><strong>{employees.length}</strong><small>Total employees</small></p></article><article><span>PL</span><p><strong>{new Set(employees.map(row=>row.position).filter(Boolean)).size}</strong><small>Positions represented</small></p></article><article><span>UA</span><p><strong>{Math.max(0,employees.length-users.length)}</strong><small>Without user accounts</small></p></article></section><div className="master-home-toolbar"><label className="search">⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search employee or current position…"/></label><form onSubmit={event=>{event.preventDefault();if(!name.trim()||!position)return;setEmployees([...employees,{id:Date.now(),name:name.trim(),position}]);setName("");setPosition("")}}><input value={name} onChange={e=>setName(e.target.value)} placeholder="Employee name" required/><select value={position} onChange={e=>setPosition(e.target.value)} required><option value="">Current position</option>{plantilla.map(row=><option key={row.id}>{row.title}</option>)}</select><button className="primary-button">＋ Add employee</button></form></div>{!plantilla.length&&<div className="role-prerequisite"><b>Plantilla required</b><p>Add positions under Plantilla before creating employee records.</p><button onClick={()=>setSection("Plantilla")}>Open Plantilla →</button></div>}<section className="panel"><div className="table-wrap"><table className="data-table"><thead><tr><th>Employee Name</th><th>Current Position</th><th>User Account</th><th>Action</th></tr></thead><tbody>{filteredEmployees.map(row=><tr key={row.id}><td><strong>{row.name}</strong></td><td><select value={row.position||""} onChange={e=>setEmployees(employees.map(employee=>employee.id===row.id?{...employee,position:e.target.value}:employee))}><option value="">Select current position</option>{plantilla.map(item=><option key={item.id}>{item.title}</option>)}</select></td><td>{users.some(user=>user.employee===row.name)?<Badge value="Active"/>:<span className="muted">Not linked</span>}</td><td><button className="text-button" onClick={()=>{const next=window.prompt("Edit employee name",row.name)?.trim();if(next)setEmployees(employees.map(item=>item.id===row.id?{...item,name:next}:item))}}>Edit</button></td></tr>)}</tbody></table></div></section></section>}
  {(section==="Division"||section==="UOM")&&<section className="master-home"><div className="master-home-toolbar"><label className="search">⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder={`Search ${section.toLowerCase()}…`}/></label><form onSubmit={event=>{event.preventDefault();if(!name.trim())return;setMasters({...masters,[section]:[...masters[section],name.trim()]});setName("")}}><input value={name} onChange={e=>setName(e.target.value)} placeholder={section==="UOM"?"Name or abbreviation":"Division name"} required/><button className="primary-button">＋ Add {section}</button></form></div><MasterList title={section} rows={masters[section]}/></section>}
  {section==="UACS"&&<section className="uacs-home"><div className="master-home-toolbar"><label className="search">⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search UACS code, title, or classification…"/></label><span>{filteredUacs.length} accounts</span></div><form className="uacs-entry panel" onSubmit={event=>{event.preventDefault();if(!uacsDraft.code.trim()||!uacsDraft.title.trim())return;setUacs([...uacs,{...uacsDraft,code:uacsDraft.code.trim(),title:uacsDraft.title.trim(),active:true}]);setUacsDraft({code:"",title:"",classification:"Expendable",subMajor:"",glAccount:""})}}><label>UACS Object Code<input value={uacsDraft.code} onChange={e=>setUacsDraft({...uacsDraft,code:e.target.value})} required/></label><label>Account Title<input value={uacsDraft.title} onChange={e=>setUacsDraft({...uacsDraft,title:e.target.value})} required/></label><label>Classification<select value={uacsDraft.classification} onChange={e=>setUacsDraft({...uacsDraft,classification:e.target.value as Classification})}><option>Expendable</option><option>Semi-Expendable</option><option>Capital Outlay</option></select></label><label>PPE Sub-Major <small>Optional</small><input maxLength={2} value={uacsDraft.subMajor} onChange={e=>setUacsDraft({...uacsDraft,subMajor:e.target.value})}/></label><label>GL Account <small>Optional</small><input maxLength={2} value={uacsDraft.glAccount} onChange={e=>setUacsDraft({...uacsDraft,glAccount:e.target.value})}/></label><button className="primary-button">＋ Add UACS</button></form><section className="panel"><div className="table-wrap"><table className="data-table"><thead><tr><th>UACS Object Code</th><th>Account Title</th><th>Classification</th><th>PPE Sub-Major</th><th>GL Account</th><th>Status</th><th>Action</th></tr></thead><tbody>{filteredUacs.map((row,index)=><tr key={`${row.code}-${index}`}><td><strong>{row.code}</strong></td><td>{row.title}</td><td><span className="class-tag">{row.classification}</span></td><td>{row.subMajor||"—"}</td><td>{row.glAccount||"—"}</td><td><Badge value={row.active?"Active":"Inactive"}/></td><td><button className="text-button" onClick={()=>{const next=window.prompt("Edit UACS account title",row.title)?.trim();if(next)setUacs(uacs.map(item=>item.code===row.code?{...item,title:next}:item))}}>Edit</button></td></tr>)}</tbody></table></div></section></section>}
  {section==="System Settings"&&<section className="system-settings-updated"><article className="panel branding-settings"><div className="panel-heading"><div><h3>Agency Dashboard Palette</h3><p>Two required colors and one optional third. Neutral white and gray are used only for readability.</p></div></div><ThemePicker colors={theme.colors} onChange={colors=>setTheme({...theme,colors})}/></article><article className="panel formula-setting"><div className="panel-heading"><div><h3>Inventory Costing Formula</h3><p>Used for expendable issue valuation, Stock Cards, and RPCI.</p></div></div><div><label>Current Formula<select value={theme.formula} onChange={e=>{setTheme({...theme,formula:e.target.value as CostFormula});setFormulaNotice(true)}}><option>FIFO</option><option>Running Average</option></select></label><div className="formula-change-warning"><b>⚠ Historical transaction warning</b><p>You may change the formula anytime, but previously completed transactions cannot be undone or automatically recalculated. To use the new formula for those records, the affected transactions must be recreated.</p></div>{formulaNotice&&<p className="setting-success">✓ Formula updated for new and recreated transactions.</p>}</div></article></section>}
  </>;
}

function SinopDmwWorkspace({ theme }: { theme: AgencyTheme }) {
  useEffect(() => {
    localStorage.setItem("sinop-tenant-theme", JSON.stringify(theme));
  }, [theme]);
  return <iframe className="sinop-dmw-workspace" title="Sinop inventory and property workspace" src="/workspace/index.html" />;
}

// Temporary preview switch: keep the sales website and onboarding available in
// the code while opening the complete Sinop application directly for review.
const DIRECT_APP_PREVIEW = true;

export default function Home() {
  const [journey, setJourney] = useState<"landing" | "login" | "registration" | "setup" | "app">(DIRECT_APP_PREVIEW ? "app" : "landing");
  const [requestedPlan, setRequestedPlan] = useState<SubscriptionPlan>("Yearly");
  const [registration, setRegistration] = useState<RegistrationData | null>(null);
  const [module, setModule] = useState<Module>("Dashboard");
  const [mobileNav, setMobileNav] = useState(false);
  const [pos, setPos] = useState(seedPOs);
  const [iars, setIars] = useState(seedIARs);
  const [poModal, setPoModal] = useState(false);
  const [iarPO, setIarPO] = useState<PurchaseOrder | null>(null);
  const [theme,setTheme]=useState<AgencyTheme>({agencyName:"Sinop Demo Agency",agencyAddress:"",logoPreview:"",headerPreview:"",colors:["#0F2942","#059669"],formula:"FIFO"});
  const [adminSection,setAdminSection]=useState<SinopAdminTab>("Employees");
  const [employees,setEmployees]=useState<EmployeeRecord[]>([]);
  const [plantilla,setPlantilla]=useState<PlantillaRecord[]>([]);
  const [users,setUsers]=useState<WorkspaceUser[]>([]);
  const [masters,setMasters]=useState<MasterLists>({Division:[],UOM:["Piece","Box","Ream","Unit"],"Procurement Modes":[...procurementModes,"Agency-To-Agency"],UACS:[]});
  const [uacs,setUacs]=useState<UacsRecord[]>(officialUacs);
  const [transfer,setTransfer]=useState<DmwTransferData|null>(null);
  const [transferError,setTransferError]=useState("");
  useEffect(()=>{
    const handleFallbackAction=(event:MouseEvent)=>{
      const button=(event.target as HTMLElement).closest("button"); if(!button)return;
      const label=button.textContent?.trim();
      if(label==="Forgot password?")tell("Password recovery will send a secure link after the workspace email service is connected. No account data was changed.");
      if(label==="Sample action")tell("Your selected agency palette is active and readable in this preview.");
      if(label==="Primary action")tell("The primary action uses the current agency colors with automatic contrast protection.");
    };
    document.addEventListener("click",handleFallbackAction);
    return()=>document.removeEventListener("click",handleFallbackAction);
  },[]);
  useEffect(()=>{
    let active=true;
    fetch("/data/dmw-data-transfer.json").then(async response=>{if(!response.ok)response=await fetch("/data/dmw-data-transfer.sample.json");if(!response.ok)throw new Error(`Transfer package could not be loaded (${response.status}).`);return response.json() as Promise<DmwTransferData>}).then(bundle=>{
      if(!active)return;
      const expected=Object.values(bundle.record_counts??{}).reduce((sum,count)=>sum+count,0);
      const actual=Object.values(bundle.data??{}).reduce((sum,rows)=>sum+rows.length,0);
      if(bundle.export_format!=="DMW Inventory relational data package"||expected!==actual)throw new Error("Transfer package validation failed. No data was applied.");
      const data=bundle.data; const suppliers=rowsById(data.suppliers); const poRows=rowsById(data.purchase_orders); const poItems=data.purchase_order_items??[]; const itemRows=rowsById(data.items);
      const poLines=new Map<string,TransferRow[]>(); poItems.forEach(row=>{const id=textValue(row,"purchase_order_id");poLines.set(id,[...(poLines.get(id)??[]),row])});
      setPos((data.purchase_orders??[]).map(row=>{const lines=poLines.get(textValue(row,"id"))??[];const first=lines[0];return {id:textValue(row,"id"),number:textValue(row,"po_number"),date:textValue(row,"po_date"),supplier:textValue(suppliers.get(textValue(row,"supplier_id")),"supplier_name")||"Unknown supplier",pr:textValue(row,"purchase_request_number"),mode:textValue(row,"mode_of_procurement"),fund:textValue(row,"fund_source"),status:textValue(row,"status") as POStatus,item:lines.length===1?textValue(first,"item_description"):`${lines.length} line items`,category:"Imported",quantity:lines.reduce((sum,line)=>sum+numberValue(line,"quantity_ordered"),0),unit:textValue(itemRows.get(textValue(first,"item_id")),"unit_of_measure"),unitCost:numberValue(first,"unit_cost"),total:lines.reduce((sum,line)=>sum+numberValue(line,"total_cost"),0),lineCount:lines.length}}).sort((a,b)=>b.date.localeCompare(a.date)));
      const iarLines=data.inspection_acceptance_items??[]; const iarById=new Map<string,TransferRow[]>();iarLines.forEach(row=>{const id=textValue(row,"iar_id");iarById.set(id,[...(iarById.get(id)??[]),row])}); const poItemRows=rowsById(poItems);
      setIars((data.inspection_acceptance_reports??[]).map(row=>{const lines=iarById.get(textValue(row,"id"))??[];const po=poRows.get(textValue(row,"purchase_order_id"));const firstPoItem=poItemRows.get(textValue(lines[0],"purchase_order_item_id"));return {id:textValue(row,"id"),number:textValue(row,"iar_number"),poNumber:textValue(po,"po_number"),supplier:textValue(suppliers.get(textValue(po,"supplier_id")),"supplier_name")||"Unknown supplier",date:textValue(row,"iar_date"),delivered:lines.reduce((sum,line)=>sum+numberValue(line,"quantity_delivered"),0),accepted:lines.reduce((sum,line)=>sum+numberValue(line,"quantity_accepted"),0),rejected:lines.reduce((sum,line)=>sum+numberValue(line,"quantity_rejected"),0),status:textValue(row,"status") as IARStatus,item:lines.length===1?textValue(firstPoItem,"item_description"):`${lines.length} line items`,classification:(textValue(lines[0],"final_classification")||undefined) as Classification|undefined}}).sort((a,b)=>b.date.localeCompare(a.date)));
      const offices=rowsById(data.offices);
      setEmployees((data.employees??[]).map(row=>({id:textValue(row,"id"),name:textValue(row,"full_name"),position:textValue(row,"plantilla_position"),division:textValue(offices.get(textValue(row,"office_id")),"name"),employeeNumber:textValue(row,"employee_number"),active:Boolean(row.active)})).sort((a,b)=>a.name.localeCompare(b.name)));
      const settings=data.system_settings??[];
      setPlantilla(settings.filter(row=>textValue(row,"setting_key").startsWith("plantilla_position:")).map(row=>({id:textValue(row,"setting_key").split(":")[1],title:textValue(row,"text_value")})).sort((a,b)=>a.title.localeCompare(b.title)));
      const uom=settings.filter(row=>textValue(row,"setting_key").startsWith("uom:")).map(row=>{const json=row.json_value as {name?:string}|null;const name=json?.name||textValue(row,"text_value");const abbreviation=textValue(row,"text_value");return name===abbreviation?name:`${name} (${abbreviation})`}).sort();
      const modes=settings.filter(row=>textValue(row,"setting_key").startsWith("procurement_mode:")).map(row=>textValue(row,"text_value")).sort();
      setMasters({Division:(data.offices??[]).map(row=>textValue(row,"name")).sort(),UOM:uom,"Procurement Modes":modes,UACS:(data.uacs_accounts??[]).map(row=>`${textValue(row,"uacs_code")} · ${textValue(row,"account_title")}`).sort()});
      setUacs((data.uacs_accounts??[]).map(row=>({code:textValue(row,"uacs_code"),title:textValue(row,"account_title"),classification:textValue(row,"account_category") as Classification,subMajor:textValue(row,"ppe_sub_major"),glAccount:textValue(row,"gl_account"),active:Boolean(row.active)})));
      const officeName=textValue(settings.find(row=>textValue(row,"setting_key")==="office_name"),"text_value"); if(officeName)setTheme(current=>({...current,agencyName:officeName}));
      setTransfer(bundle);
    }).catch(error=>active&&setTransferError(error instanceof Error?error.message:"Transfer package could not be loaded."));
    return()=>{active=false};
  },[]);
  const title = useMemo(() => module === "Inspection and Acceptance Reports" ? "Inspection & Acceptance" : module, [module]);
  const chooseModule = (next: Module) => { setModule(next); setMobileNav(false); };
  if (journey === "landing") return <SinopLanding onEnter={()=>{window.scrollTo(0,0);setJourney("app")}} onLogin={()=>{window.scrollTo(0,0);setJourney("login")}} onRegister={plan=>{setRequestedPlan(plan);window.scrollTo(0,0);setJourney("registration")}}/>;
  if (journey === "login") return <SinopLogin onBack={()=>{window.scrollTo(0,0);setJourney("landing")}} onRegister={()=>{setRequestedPlan("Yearly");window.scrollTo(0,0);setJourney("registration")}} onLogin={()=>{window.scrollTo(0,0);setJourney("app")}}/>;
  if (journey === "registration") return <SinopTrialRegistration initialPlan={requestedPlan} onBack={()=>{window.scrollTo(0,0);setJourney("landing")}} onComplete={data=>{setRegistration(data);window.scrollTo(0,0);setJourney("setup")}}/>;
  if (journey === "setup" && registration) return <SinopAgencySetup registration={registration} onFinish={agencyTheme=>{setTheme(agencyTheme);window.scrollTo(0,0);setJourney("app")}}/>;
  if (journey === "app") return <SinopDmwWorkspace theme={theme}/>;
  return (
    <div className="app-shell tenant-themed" style={themeVariables(theme)}>
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="brand"><span>{theme.logoPreview?<img src={theme.logoPreview} alt="Agency logo"/>:<img src="/sinop-mark.svg" alt=""/>}</span><div><strong>SINOP</strong><p>{theme.agencyName}</p></div></div>
        <nav aria-label="Main navigation"><small>MAIN MODULES</small>{nav.slice(0,3).map(item=><button className={module===item.name?"active":""} onClick={()=>chooseModule(item.name)} key={item.name}><i>{item.short}</i><span>{item.name}</span>{item.name==="Inspection and Acceptance Reports" && <b>5</b>}</button>)}<small>MANAGEMENT</small>{nav.slice(3).map(item=><button className={`${module===item.name?"active":""} ${item.name==="Admin Options"&&(employees.length===0||plantilla.length===0)?"setup-pulse":""}`} onClick={()=>{chooseModule(item.name);if(item.name==="Admin Options")setAdminSection(plantilla.length===0?"Plantilla":employees.length===0?"Employees":"Users")}} key={item.name}><i>{item.short}</i><span>{item.name}</span>{item.name==="Admin Options"&&(employees.length===0||plantilla.length===0)&&<b>!</b>}</button>)}</nav>
        <div className="sidebar-foot"><div><span>✓</span><p><strong>System operational</strong><small>Last sync · Just now</small></p></div><p>{theme.agencyName} · Agency workspace</p></div>
      </aside>
      {mobileNav && <button className="nav-scrim" onClick={()=>setMobileNav(false)} aria-label="Close navigation"/>}
      <div className="content-shell"><Topbar title={title} onMenu={()=>setMobileNav(true)}/><main>{transferError&&<section className="success-banner transfer-error"><b>!</b><div><strong>Data transfer was not applied</strong><p>{transferError}</p></div></section>}{transfer&&<section className="data-transfer-banner"><span>VERIFIED DATASET</span><p><strong>{Object.values(transfer.record_counts).reduce((sum,count)=>sum+count,0)} records applied</strong> · exported {dateLabel(transfer.exported_at)} · source relationships preserved</p></section>}{module==="Dashboard"&&(employees.length===0||plantilla.length===0)&&<section className="dashboard-setup-signal"><span>ACCESS SETUP</span><div><b>{plantilla.length===0?"Create the Plantilla master list":"Create the Employee master list"}</b><p>The registered account owner is already the Superadmin. Complete Plantilla and Employees before creating users or assigning roles.</p></div><button className="primary-button" onClick={()=>{setAdminSection(plantilla.length===0?"Plantilla":"Employees");setModule("Admin Options")}}>Continue setup →</button></section>} {module==="Dashboard"&&<SinopDashboardUpdated users={users} theme={theme} transfer={transfer} onAdmin={()=>{setAdminSection("Users");setModule("Admin Options")}}/>} {module==="Purchase Orders"&&<PurchaseOrders pos={pos} setPos={setPos} openPO={()=>setPoModal(true)} onCreateIAR={setIarPO}/>} {module==="Inspection and Acceptance Reports"&&<IARModule iars={iars} setIars={setIars} pos={pos} onCreate={setIarPO} onReviewCategories={()=>{setAdminSection("UACS");setModule("Admin Options")}}/>} {module==="Requisition and Issue Slips"&&<RISModule transfer={transfer}/>} {module==="Property Records"&&<PropertyRecords transfer={transfer}/>} {module==="Admin Options"&&<SinopAdminUpdated theme={theme} setTheme={setTheme} section={adminSection} setSection={setAdminSection} employees={employees} setEmployees={setEmployees} plantilla={plantilla} setPlantilla={setPlantilla} users={users} setUsers={setUsers} masters={masters} setMasters={setMasters} uacs={uacs} setUacs={setUacs}/>} {module==="Forms"&&<FormsLibrary/>} {module==="Reports"&&<Reports setModule={setModule}/>}</main></div>
      {poModal&&<PurchaseOrderModal transfer={transfer} onClose={()=>setPoModal(false)} onSave={po=>{setPos([po,...pos]);setPoModal(false)}}/>}
      {iarPO&&<IARModal po={iarPO} onClose={()=>setIarPO(null)} onSave={iar=>{setIars([iar,...iars]);setIarPO(null);setModule("Inspection and Acceptance Reports")}}/>}
    </div>
  );
}
