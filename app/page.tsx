"use client";

import { FormEvent, useMemo, useState } from "react";

type Module = "Dashboard" | "Purchase Orders" | "Inspection and Acceptance Reports" | "Requisition and Issue Slips" | "Property Records" | "Admin Options" | "Reports";
type POStatus = "Draft" | "Completed" | "Cancelled";
type IARStatus = "Draft" | "Partially Inspected" | "Completed";
type Classification = "Expendable" | "Semi-Expendable" | "Capital Outlay";

type PurchaseOrder = {
  id: number;
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
};

type IAR = {
  id: number;
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
        <button className="icon-button" aria-label="Notifications">♢<span /></button>
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
          <div className="table-wrap"><table><thead><tr><th>PO number</th><th>Supplier</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>{pos.slice(0,4).map(po => <tr key={po.id}><td><strong className="linkish">{po.number}</strong></td><td>{po.supplier}</td><td>{new Date(po.date).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"})}</td><td>{peso.format(po.quantity * po.unitCost)}</td><td><Badge value={po.status}/></td></tr>)}</tbody></table></div>
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
  const filtered = pos.filter(po => `${po.number} ${po.supplier} ${po.status}`.toLowerCase().includes(query.toLowerCase()));
  const complete = (id: number) => setPos(pos.map(po => po.id === id ? { ...po, status: "Completed" } : po));
  return (
    <>
      <section className="page-heading"><div><h2>Purchase Orders</h2><p>Encode, track, and manage all purchase orders.</p></div><button className="primary-button" onClick={openPO}>＋ Create purchase order</button></section>
      <section className="mini-stats">
        <div><span>All purchase orders</span><strong>{pos.length}</strong></div><div><span>Active</span><strong>{pos.filter(p=>p.status!=="Cancelled").length}</strong></div><div><span>Completed this month</span><strong>6</strong></div><div><span>Total value</span><strong>{peso.format(pos.reduce((a,p)=>a+p.quantity*p.unitCost,0))}</strong></div>
      </section>
      <section className="panel">
        <div className="toolbar"><label className="search">⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search PO number or supplier…" /></label><div><select aria-label="Filter status"><option>All statuses</option><option>Draft</option><option>Completed</option></select><button className="secondary-button">⇩ Export</button></div></div>
        <div className="table-wrap"><table className="data-table"><thead><tr><th>PO number</th><th>PO date</th><th>Supplier / PR no.</th><th>Procurement mode</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filtered.map(po => <tr key={po.id}><td><strong className="linkish">{po.number}</strong></td><td>{new Date(po.date).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"})}</td><td><strong>{po.supplier}</strong><small>{po.pr}</small></td><td>{po.mode}</td><td><strong>{peso.format(po.quantity*po.unitCost)}</strong></td><td><Badge value={po.status}/></td><td><div className="row-actions">{po.status==="Draft" && <button onClick={()=>complete(po.id)}>Complete</button>}{po.status==="Completed" && <button onClick={()=>onCreateIAR(po)}>Create IAR</button>}<button aria-label={`More actions for ${po.number}`}>•••</button></div></td></tr>)}</tbody></table></div>
        <div className="pagination"><span>Showing 1–{filtered.length} of {filtered.length} purchase orders</span><div><button disabled>‹</button><button className="active">1</button><button>2</button><button>3</button><button>›</button></div></div>
      </section>
    </>
  );
}

function IARModule({ iars, setIars }: { iars: IAR[]; setIars: (x: IAR[]) => void }) {
  const completeIAR = (iar: IAR) => {
    const classification: Classification = iar.item.toLowerCase().includes("paper") ? "Expendable" : iar.item.toLowerCase().includes("computer") ? "Capital Outlay" : "Semi-Expendable";
    setIars(iars.map(x => x.id === iar.id ? { ...x, status: "Completed", classification } : x));
  };
  return (
    <>
      <section className="page-heading"><div><h2>Inspection and Acceptance Reports</h2><p>Inspect deliveries and process only accepted quantities into inventory.</p></div><button className="primary-button">＋ Create from completed PO</button></section>
      <section className="process-line"><div className="done"><b>1</b><span>Purchase order<small>Completed</small></span></div><i/><div className="current"><b>2</b><span>Inspection & acceptance<small>Validate delivery</small></span></div><i/><div><b>3</b><span>Item classification<small>Automatic by category</small></span></div><i/><div><b>4</b><span>Inventory records<small>Batches or property units</small></span></div></section>
      <section className="panel">
        <div className="toolbar"><label className="search">⌕<input placeholder="Search IAR or PO number…" /></label><select aria-label="Filter IAR status"><option>All statuses</option><option>Draft</option><option>Partially Inspected</option><option>Completed</option></select></div>
        <div className="table-wrap"><table className="data-table"><thead><tr><th>IAR number</th><th>Related PO</th><th>Supplier</th><th>Date</th><th>Accepted</th><th>Classification</th><th>Status</th><th>Actions</th></tr></thead><tbody>{iars.map(iar => <tr key={iar.id}><td><strong className="linkish">{iar.number}</strong></td><td>{iar.poNumber}</td><td>{iar.supplier}</td><td>{new Date(iar.date).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"})}</td><td><strong>{iar.accepted}</strong> / {iar.delivered}</td><td>{iar.classification ? <span className={`class-tag ${iar.classification.split(" ")[0].toLowerCase()}`}>{iar.classification}</span> : <span className="muted">Upon completion</span>}</td><td><Badge value={iar.status}/></td><td><div className="row-actions">{iar.status!=="Completed" && <button onClick={()=>completeIAR(iar)}>Complete & process</button>}<button>View</button></div></td></tr>)}</tbody></table></div>
      </section>
      <section className="info-banner"><span>i</span><div><strong>Classification rule in effect</strong><p>Consumables are expendable. Property below ₱50,000 per item is semi-expendable; qualifying PPE at ₱50,000 or above is capital outlay. Manual corrections require a reason.</p></div><button>Review categories</button></section>
    </>
  );
}

function RISModule() {
  const [issued, setIssued] = useState(false);
  return (
    <>
      <section className="page-heading"><div><h2>Requisition and Issue Slips</h2><p>Issue expendable supplies using first-in, first-out inventory costing.</p></div><button className="primary-button" onClick={()=>setIssued(true)}>＋ New RIS</button></section>
      {issued && <div className="success-banner"><b>✓</b><div><strong>RIS-2026-0120 issued successfully</strong><p>18 units were deducted from the oldest available batches. Running balances and the stock ledger were updated.</p></div><button onClick={()=>setIssued(false)}>×</button></div>}
      <section className="mini-stats"><div><span>Available item types</span><strong>186</strong></div><div><span>Units on hand</span><strong>4,286</strong></div><div><span>Issued this month</span><strong>387</strong></div><div><span>Inventory value</span><strong>₱864,320</strong></div></section>
      <section className="dashboard-grid">
        <article className="panel span-2"><div className="panel-heading"><div><h3>Recent RIS transactions</h3><p>Latest issues to requesting offices</p></div><button className="secondary-button">Print RSMI</button></div><div className="table-wrap"><table><thead><tr><th>RIS number</th><th>Date</th><th>Requesting office</th><th>Items</th><th>Value</th><th>Status</th></tr></thead><tbody>{[["RIS-2026-0119","Jul 24, 2026","Finance Division","8","₱12,480"],["RIS-2026-0118","Jul 23, 2026","Administrative Division","32","₱28,115"],["RIS-2026-0117","Jul 21, 2026","Planning Division","11","₱9,840"],["RIS-2026-0116","Jul 18, 2026","Regional Operations","19","₱17,225"]].map(r=><tr key={r[0]}><td><strong className="linkish">{r[0]}</strong></td><td>{r[1]}</td><td>{r[2]}</td><td>{r[3]}</td><td>{r[4]}</td><td><Badge value="Completed"/></td></tr>)}</tbody></table></div></article>
        <article className="panel"><div className="panel-heading"><div><h3>FIFO batch availability</h3><p>Oldest batches ready for issue</p></div></div><div className="batch-list">{[["A4 Copy Paper","B-2026-0041","108 reams","₱244"],["Printer Ink, Black","B-2026-0038","12 units","₱1,145"],["Alcohol, 500ml","B-2026-0035","18 bottles","₱82"],["Legal-size Folder","B-2026-0032","34 pcs","₱18"]].map(b=><div key={b[1]}><span><strong>{b[0]}</strong><small>{b[1]} · Oldest open batch</small></span><span><strong>{b[2]}</strong><small>{b[3]} / unit</small></span></div>)}</div></article>
      </section>
    </>
  );
}

function PropertyRecords() {
  const units = [
    ["SEP-2026-0134","Semi-Expendable","Ergonomic Office Chair","ErgoWorks Flex 2","Not entered","₱12,450","PO-2026-0048 / IAR-2026-0039","Maria L. Santos","Room 302","Good","Issued"],
    ["SEP-2026-0135","Semi-Expendable","Ergonomic Office Chair","ErgoWorks Flex 2","Not entered","₱12,450","PO-2026-0048 / IAR-2026-0039","Unassigned","Supply Room","Good","Available"],
    ["Needs assignment","Semi-Expendable","Steel Filing Cabinet","SecureLine FC-4D","Not entered","₱18,750","PO-2026-0043 / IAR-2026-0035","Liza M. Garcia","Records Unit","Good","Issued"],
    ["PPE-2026-0062","Capital Outlay","Desktop Computer Set","Northstar ProDesk G5","NSG5-11082","₱68,750","PO-2026-0047 / IAR-2026-0040","Jose R. Dela Cruz","Finance Room 204","Good","Issued"],
    ["PPE-2026-0058","Capital Outlay","Portable Generator","VoltMax VG-9000","VM9-04418","₱89,500","PO-2026-0045 / IAR-2026-0037","Ramon T. Lim","Motor Pool","Good","Issued"],
  ];
  return <>
    <section className="page-heading"><div><h2>Property Records</h2><p>Individual semi-expendable and capital-outlay units created from completed IARs.</p></div><div><button className="secondary-button">⇩ Export CSV</button> <button className="secondary-button">Print list</button></div></section>
    <section className="property-summary"><article><span className="metric-icon violet">SE</span><div><p>Semi-Expendable</p><strong>314 units</strong><small>₱2,849,150 acquisition value</small></div></article><article><span className="metric-icon navy">CO</span><div><p>Capital Outlay</p><strong>126 units</strong><small>₱18,756,800 acquisition value</small></div></article><article><span className="metric-icon amber">MI</span><div><p>Missing identifiers</p><strong>3 units</strong><small>Property or serial number required</small></div></article></section>
    <section className="panel"><div className="toolbar toolbar-wrap"><label className="search">⌕<input placeholder="Search property no., item, employee, PO, or IAR…"/></label><div><select><option>All classifications</option><option>Semi-Expendable</option><option>Capital Outlay</option></select><select><option>All statuses</option><option>Available</option><option>Issued</option><option>Under Repair</option></select></div></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Property number</th><th>Classification / item</th><th>Brand / model / serial</th><th>Acquisition</th><th>Source documents</th><th>Issued to</th><th>Location</th><th>Condition</th><th>Status</th><th>Actions</th></tr></thead><tbody>{units.map((u,i)=><tr key={i}><td><strong className={u[0]==="Needs assignment"?"missing-value":"linkish"}>{u[0]}</strong></td><td><span className={`class-tag ${u[1]==="Capital Outlay"?"capital":"semi"}`}>{u[1]}</span><small><strong>{u[2]}</strong></small></td><td><strong>{u[3]}</strong><small>Serial: {u[4]}</small></td><td><strong>{u[5]}</strong><small>July 2026</small></td><td>{u[6]}</td><td>{u[7]}</td><td>{u[8]}</td><td>{u[9]}</td><td><Badge value={u[10]}/></td><td><div className="row-actions"><button>Edit / assign</button><button>View</button></div></td></tr>)}</tbody></table></div></section>
  </>;
}

function Admin({ threshold, setThreshold }: { threshold: number; setThreshold: (n: number) => void }) {
  const [saved, setSaved] = useState(false);
  return (
    <>
      <section className="page-heading"><div><h2>Admin Options</h2><p>Maintain item categories, classification rules, and system settings.</p></div></section>
      <section className="settings-grid">
        <article className="panel"><div className="panel-heading"><div><h3>Acquisition-cost threshold</h3><p>Applied to each individual accepted property item.</p></div></div><div className="setting-form"><label>Capitalization threshold<span className="money-input"><b>₱</b><input type="number" value={threshold} onChange={e=>setThreshold(Number(e.target.value))}/></span></label><p>Qualifying PPE at or above this unit cost is classified as Capital Outlay. Items below it with a useful life over one year are Semi-Expendable.</p><button className="primary-button" onClick={()=>{setSaved(true);setTimeout(()=>setSaved(false),2500)}}>{saved ? "✓ Setting saved" : "Save setting"}</button></div></article>
        <article className="panel"><div className="panel-heading"><div><h3>Classification summary</h3><p>Configured item category behavior</p></div></div><div className="classification-summary"><div><span className="dot expendable"/><p><strong>Expendable</strong><small>Consumable supplies and materials</small></p><b>24 categories</b></div><div><span className="dot semi"/><p><strong>Semi-Expendable</strong><small>Property below the threshold</small></p><b>11 categories</b></div><div><span className="dot capital"/><p><strong>Capital Outlay</strong><small>Qualifying property at or above threshold</small></p><b>9 categories</b></div></div></article>
      </section>
      <section className="panel"><div className="panel-heading"><div><h3>Item categories</h3><p>Each category controls normal or threshold-based classification.</p></div><button className="primary-button">＋ Add category</button></div><div className="table-wrap"><table><thead><tr><th>Category</th><th>Useful life</th><th>Classification rule</th><th>Default UACS</th><th>Status</th><th></th></tr></thead><tbody>{[["Office Supplies","Less than 1 year","Always Expendable","50203010"],["ICT Equipment","More than 1 year","Threshold-based","10605030"],["Furniture & Fixtures","More than 1 year","Threshold-based","10607010"],["Machinery & Equipment","More than 1 year","Threshold-based","10605990"],["Janitorial Supplies","Less than 1 year","Always Expendable","50203020"]].map(r=><tr key={r[0]}><td><strong>{r[0]}</strong></td><td>{r[1]}</td><td><span className="class-tag">{r[2]}</span></td><td>{r[3]}</td><td><Badge value="Active"/></td><td><button className="text-button">Edit</button></td></tr>)}</tbody></table></div></section>
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
        ].map((r,i)=><article className="report-card" key={r[0]}><span>{["RS","PP","SP","SC","PC","PI"][i]}</span><div><h3>{r[0]}</h3><strong>{r[1]}</strong><p>{r[2]}</p><small>{r[3]}</small></div><button>Generate →</button></article>)}
      </section>
      <section className="panel"><div className="panel-heading"><div><h3>July 2026 reporting readiness</h3><p>Source records included in the selected period</p></div><Badge value="On track"/></div><div className="readiness"><div><b>42</b><span>Completed POs</span></div><div><b>38</b><span>Completed IARs</span></div><div><b>119</b><span>RIS transactions</span></div><div><b>0</b><span>Unposted records</span></div><div className="ready-check">✓ All completed transactions are ready for reporting</div></div></section>
    </>
  );
}

function PurchaseOrderModal({ onClose, onSave }: { onClose: () => void; onSave: (po: PurchaseOrder) => void }) {
  const [quantity, setQuantity] = useState(1);
  const [cost, setCost] = useState(0);
  const [supplierAddress, setSupplierAddress] = useState("");
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const status: POStatus = submitter?.value === "approve" ? "Completed" : "Draft";
    onSave({ id: Date.now(), number: String(fd.get("number")), date: String(fd.get("date")), supplier: String(fd.get("supplier")), pr: String(fd.get("pr")), mode: String(fd.get("mode")), fund: String(fd.get("fund")), status, item: String(fd.get("item")), category: "Office Supplies", quantity, unit: String(fd.get("unit")), unitCost: cost });
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
            <label className="wide">Supplier <span className="required-mark">*</span><select name="supplier" defaultValue="" required onChange={e=>setSupplierAddress(supplierOptions.find(supplier=>supplier.name===e.target.value)?.address||"")}><option value="" disabled>Select supplier from master data</option>{supplierOptions.map(supplier=><option key={supplier.name} value={supplier.name}>{supplier.name}</option>)}</select></label>
            <label className="wide">Supplier address<textarea value={supplierAddress} placeholder="Select a supplier to load its address" readOnly/><small className="field-hint">Linked to the supplier master record. Edit this address under Admin Options → Suppliers.</small></label>
            <label>Purchase Request no. <span className="optional-mark">Optional</span><input name="pr" placeholder="May be left blank"/></label>
            <label>Mode of procurement <span className="required-mark">*</span><select name="mode" defaultValue="" required><option value="" disabled>Select mode under RA 12009</option>{procurementModes.map(mode=><option key={mode}>{mode}</option>)}</select></label>
            <label className="wide">Delivery location<input value="3rd Floor Esquina Dos Bldg, J.C. Aquino Ave, Butuan City" readOnly/><small className="field-hint">Permanent delivery location</small></label>
            <label>Delivery period<input placeholder="15 calendar days"/></label>
            <label>Fund source<select name="fund" defaultValue="Regular Fund 01"><option>Regular Fund 01</option></select></label>
          </div>
          <div className="po-items-heading"><div><h3>Purchase order items</h3><p>Enter the item details and acquisition cost.</p></div><button type="button">＋ Add item</button></div>
          <div className="po-item-table-wrap">
            <table className="po-item-editor">
              <thead><tr><th>Item No.</th><th>UOM</th><th>Item Description</th><th>QTY</th><th>Unit Cost</th><th>Total Cost</th></tr></thead>
              <tbody><tr>
                <td><input aria-label="Item number" value="1" readOnly/></td>
                <td><input aria-label="Unit of measure" name="unit" placeholder="UOM" defaultValue="ream" required/></td>
                <td><select aria-label="Item description" name="item" required><option>A4 Copy Paper, 80gsm</option><option>Printer Ink, Black</option><option>Ergonomic Office Chair</option><option>Desktop Computer Set</option></select></td>
                <td><input aria-label="Quantity" type="number" min="1" value={quantity} onChange={e=>setQuantity(Number(e.target.value))}/></td>
                <td><input aria-label="Unit cost" type="number" min="0" step="0.01" value={cost} onChange={e=>setCost(Number(e.target.value))}/></td>
                <td><output aria-label="Total cost">{peso.format(quantity*cost)}</output></td>
              </tr></tbody>
            </table>
          </div>
          <div className="po-grand-total"><span>Total Purchase Order Amount</span><strong>{peso.format(quantity*cost)}</strong></div>
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

export default function Home() {
  const [module, setModule] = useState<Module>("Dashboard");
  const [mobileNav, setMobileNav] = useState(false);
  const [pos, setPos] = useState(seedPOs);
  const [iars, setIars] = useState(seedIARs);
  const [poModal, setPoModal] = useState(false);
  const [iarPO, setIarPO] = useState<PurchaseOrder | null>(null);
  const [threshold, setThreshold] = useState(50000);
  const title = useMemo(() => module === "Inspection and Acceptance Reports" ? "Inspection & Acceptance" : module, [module]);
  const chooseModule = (next: Module) => { setModule(next); setMobileNav(false); };
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="brand"><span>PH</span><div><strong>GOVERNMENT OF THE PHILIPPINES</strong><p>Inventory Management System</p></div></div>
        <nav aria-label="Main navigation"><small>MAIN MODULES</small>{nav.slice(0,4).map(item=><button className={module===item.name?"active":""} onClick={()=>chooseModule(item.name)} key={item.name}><i>{item.short}</i><span>{item.name}</span>{item.name==="Inspection and Acceptance Reports" && <b>5</b>}</button>)}<small>MANAGEMENT</small>{nav.slice(4).map(item=><button className={module===item.name?"active":""} onClick={()=>chooseModule(item.name)} key={item.name}><i>{item.short}</i><span>{item.name}</span></button>)}</nav>
        <div className="sidebar-foot"><div><span>✓</span><p><strong>System operational</strong><small>Last sync · Just now</small></p></div><p>Version 1.0 · Internal monitoring</p></div>
      </aside>
      {mobileNav && <button className="nav-scrim" onClick={()=>setMobileNav(false)} aria-label="Close navigation"/>}
      <div className="content-shell"><Topbar title={title} onMenu={()=>setMobileNav(true)}/><main>{module==="Dashboard"&&<Dashboard pos={pos} iars={iars} setModule={setModule}/>} {module==="Purchase Orders"&&<PurchaseOrders pos={pos} setPos={setPos} openPO={()=>setPoModal(true)} onCreateIAR={setIarPO}/>} {module==="Inspection and Acceptance Reports"&&<IARModule iars={iars} setIars={setIars}/>} {module==="Requisition and Issue Slips"&&<RISModule/>} {module==="Property Records"&&<PropertyRecords/>} {module==="Admin Options"&&<Admin threshold={threshold} setThreshold={setThreshold}/>} {module==="Reports"&&<Reports setModule={setModule}/>}</main></div>
      {poModal&&<PurchaseOrderModal onClose={()=>setPoModal(false)} onSave={po=>{setPos([po,...pos]);setPoModal(false)}}/>}
      {iarPO&&<IARModal po={iarPO} onClose={()=>setIarPO(null)} onSave={iar=>{setIars([iar,...iars]);setIarPO(null);setModule("Inspection and Acceptance Reports")}}/>}
    </div>
  );
}
