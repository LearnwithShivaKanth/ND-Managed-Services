/* Ticket dashboard application.
 * Security model: imported ticket data is read and processed in this browser only.
 * Do not add network transmission or persistent storage without a security review.
 */
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const MAX_TICKET_ROWS = 100000;
const MAX_TICKET_COLUMNS = 200;

/* ---- EDIT HERE: keyword rules that decide a ticket's area of work. First match wins. ---- */
const MODULES = [
  // Explicit environment classification is handled first in classifyModule().
  ["Production Control / Manufacturing", /\b(production order|prod(?:uction)? order|batch order|manufactur(?:e|ing|ing order)|shop floor|production floor|route card|job card|report as finished|\braf\b|material consumption|bom\b|bill of materials|production scheduling|production control|co[- ]?product|by[- ]?product)\b/i],
  ["Development / UAT / Test Environment", /\b(uat|user acceptance|test environment|testing environment|sandbox|development environment|dev environment|staging environment|pre[- ]?prod(?:uction)?|quality environment|qa environment|test case|test execution)\b/i],

  // Dynamics 365 Finance & Operations business modules.
  ["Sales & Marketing", /\b(sales order|sales quotation|quotation|quote to cash|customer order|sales agreement|sales invoice|sales return|return order|customer pricing|trade agreement|rebate|commission|prospect|lead management|sales and marketing)\b/i],
  ["Procurement & Sourcing", /\b(purchase|purchasing|procurement|sourcing|request for quotation|\brfq\b|vendor collaboration|supplier collaboration|vendor onboarding|supplier onboarding|purchasing policy|procurement category|purchase receipt|purchase line|purchase confirmation)\b/i],
  ["Accounts Payable", /\b(accounts payable|vendor invoice|supplier invoice|vendor payment|supplier payment|invoice journal|payment journal|payment proposal|payment run|three[- ]way match|invoice matching|vendor balance|supplier balance|payment advice)\b/i],
  ["Accounts Receivable & Credit", /\b(accounts receivable|customer invoice|customer payment|payment settlement|customer balance|collection letter|collections|credit limit|credit management|credit note|free text invoice|dunning|interest note)\b/i],
  ["General Ledger", /\b(general ledger|ledger journal|journal entry|journal voucher|trial balance|chart of accounts|main account|financial dimension|ledger settlement|year[- ]end close|period close|fiscal period|account structure|posting profile)\b/i],
  ["Cash & Bank Management", /\b(cash and bank|bank reconciliation|bank statement|bank account|cash flow|cash forecast|deposit slip|payment reconciliation|positive pay|bank management)\b/i],
  ["Fixed Assets", /\b(fixed asset|asset depreciation|depreciation book|asset acquisition|asset disposal|asset transfer|asset proposal)\b/i],
  ["Budgeting & Budget Control", /\b(budget plan|budget register|budget control|budget reservation|budget transfer|budget planning|original budget|budget funds)\b/i],
  ["Tax & GST", /\b(gst|goods and services tax|vat|withholding tax|tds\b|tax code|tax group|tax calculation|tax settlement|e[- ]?way bill|e[- ]?invoice|electronic invoice|invoice registration)\b/i],
  ["Cost Accounting & Cost Management", /\b(cost accounting|cost management|cost allocation|cost center|cost centre|cost distribution|cost roll[- ]?up|item cost|standard cost|inventory closing|cost variance)\b/i],
  ["Project Management & Accounting", /\b(project management|project accounting|project contract|project quotation|project invoice|project category|project forecast|project hour|project expense|project journal|project estimate)\b/i],
  ["Expense Management", /\b(expense report|expense claim|travel expense|per diem|corporate card|employee reimbursement|expense management)\b/i],

  ["Commerce / Retail / POS", /\b(point of sale|\bpos\b|commerce|retail channel|store commerce|e[- ]?commerce|omnichannel|call center|assortment|price group|retail statement|shift reconciliation|cash drawer|store terminal|payment terminal|self[- ]?checkout)\b/i],
  ["Warehouse Management", /\b(warehouse management|\bwms\b|warehouse work|work line|work template|location directive|wave processing|wave label|picking|pick list|put[- ]?away|load planning|shipment|containerization|license plate|mobile device menu|cycle count|replenishment|warehouse location|warehouse receiving|warehouse dispatch)\b/i],
  ["Inventory Management", /\b(inventory management|inventory dimension|inventory transaction|inventory close|inventory adjustment|inventory transfer|on[- ]?hand|stock count|stock movement|item coverage|reservation hierarchy|serial number|batch number|batch tracking|inventory status|goods receipt|goods issue)\b/i],
  ["Master Planning & Planning Optimization", /\b(master planning|planning optimization|planned orders?|planned purchase orders?|planned production orders?|net requirements|coverage group|safety stock|demand forecast|supply forecast|min\/max planning|replenishment planning|planning engine|planning worksheet)\b/i],
  ["Transportation Management", /\b(transportation management|freight bill|freight reconciliation|carrier|route planning|transport load|shipment rate|load building|transportation tender|shipping carrier|delivery route)\b/i],
  ["Quality Management", /\b(quality order|quality association|quality test|quality group|non[- ]?conformance|quarantine order|quality management|quality inspection|quality control)\b/i],
  ["Asset Management & Maintenance", /\b(asset management|maintenance request|maintenance work order|maintenance plan|maintenance schedule|functional location|equipment maintenance|asset counter|maintenance job)\b/i],
  ["Product Information Management", /\b(product information management|\bpim\b|released product|product master|item master|product variant|product attribute|product dimension|engineering change|product catalog|sku\b|bill of material version)\b/i],

  ["Human Resources & Payroll", /\b(human resources|\bhr\b|human resource|personnel management|employee records?|employee leave|employee absence|employee self[- ]?service|worker records?|worker leave|leave balance|leave request|leave and absence|absence registration|time and attendance|payroll|compensation|benefits management|position management|recruitment|performance review|timesheet|attendance)\b/i],

  // Cross-module / platform capabilities.
  ["Data Management / DMF", /\b(data management framework|\bdmf\b|data entity|data import|data export|data migration|data package|data project|staging table|recurring integration|data management workspace|data validation|master data|duplicate data|data quality)\b/i],
  ["Integrations & APIs", /\b(integration|interface|api\b|odata|rest api|soap|web service|json|xml|service bus|logic app|azure function|webhook|endpoint|middleware|third[- ]?party|external system|inbound message|outbound message|message queue|mule ?soft|postman)\b/i],
  ["Dual-write & Dataverse", /\b(dual[- ]?write|dataverse|power platform integration|virtual table|dual write map|dual write synchronization|synch(?:ronization)? between dynamics)\b/i],
  ["Electronic Reporting & E-Invoicing", /\b(electronic reporting|\ber\b format|er configuration|format mapping|model mapping|e[- ]?invoice|electronic invoicing|invoice capture|peppol|localization configuration|tax document)\b/i],
  ["Reporting & Analytics", /\b(ssrs|reporting services|power bi|management reporter|financial report|electronic report|report design|report deployment|data lake|synapse|analytics|excel add[- ]?in|financial statement|business intelligence)\b/i],
  ["Workflow & Approvals", /\b(workflow|approval|approval hierarchy|work item|delegation|workflow batch|workflow editor|workflow configuration|purchase approval|journal approval|escalation)\b/i],
  ["Security & User Access", /\b(user access|security role|security privilege|duty assignment|role assignment|user role|permission|privilege|authorization|authorisation|authentication|login|log in|sign in|password|account locked|access denied|unauthorized|unauthorised|single sign[- ]?on|\bsso\b|multi[- ]?factor|\bmfa\b)\b/i],
  ["Database & Data Platform", /\b(database|sql server|sql database|query|stored procedure|deadlock|database backup|database restore|database recovery|data source|connection string|database connection|db server|database server|data platform)\b/i],
  ["Performance & Availability", /\b(slow|slowness|latency|lag|laggy|performance|hang(?:ing)?|timeout|time out|taking long|unresponsive|not responding|unavailable|outage|crash|service down|system down|application down|server down|deadlock|capacity issue)\b/i],
  ["Batch Jobs & Scheduling", /\b(batch job|batch processing|batch server|batch group|batch task|recurrence|scheduled job|job history|batch queue|batch execution|job scheduler|task scheduler|recurring job)\b/i],
  ["Printing & Document Management", /\b(print management|printer|printing|document management|document handling|pdf generation|document routing|label printing|check printing|print destination|print archive|ssrs print)\b/i],
  ["Email & Notifications", /\b(email|e-mail|smtp|emailing|mail not sent|notification|alert|email template|email distributor|exchange server|outgoing mail|incoming mail)\b/i],
  ["Customization & Development", /\b(customization|customisation|extension|extensions|x\+\+|visual studio|development task|code deployment|deploy package|compile error|build error|best practice|event handler|chain of command|coc\b|model store|label file|metadata|debugging|debugger)\b/i],
  ["Network & Connectivity", /\b(network connectivity|network issue|internet connection|wifi|wi-fi|wireless|vpn|proxy|dns\b|dhcp\b|firewall|router|switch port|network drive|connectivity|network latency|packet loss|remote connection)\b/i],
  ["Microsoft 365 & Collaboration", /\b(microsoft 365|office 365|outlook|exchange online|microsoft teams|teams meeting|sharepoint|onedrive|planner|microsoft forms|office application|excel workbook|word document|powerpoint)\b/i],
  ["Hardware & End-user Support", /\b(laptop|desktop pc|workstation|monitor|keyboard|mouse|docking station|headset|webcam|mobile device|computer hardware|device replacement|hardware failure|operating system install|windows update|blue screen|bitlocker)\b/i],
  ["ITSM & Service Management", /\b(servicenow|service now|service catalog|catalog item|incident management|request management|change request|\brfc\b|problem management|knowledge article|assignment group|ticket assignment|sla breach|service desk|helpdesk|help desk|it service management)\b/i],
  ["Environment & Infrastructure", /\b(environment|infrastructure|aos|application object server|iis\b|sql server|database server|azure resource|virtual machine|network|certificate|ssl|tls|storage account|service fabric|cloud hosting|server maintenance|refresh environment|database refresh|environment servicing|update package|platform update|version update|hotfix|onebox|tier.?[1-5])\b/i],
  ["Licensing & Administration", /\b(license|licence|licensing|subscription|tenant administration|tenant admin|user provisioning|user deprovisioning|system administration|admin center|feature management|configuration key|environment monitoring)\b/i],

  // Other Dynamics and software platforms, only after specific F&O areas.
  ["Dynamics 365 CE / CRM", /\b(dynamics 365 customer engagement|dynamics 365 crm|dataverse sales|dynamics sales|dynamics customer service|customer service hub|model[- ]?driven app|dynamics field service)\b/i],
  ["Dynamics 365 Business Central", /\b(business central|dynamics nav|navision)\b/i],
  ["Power Platform", /\b(power apps|power automate|power pages|power platform|power virtual agents|copilot studio)\b/i],
  ["Azure & Cloud Services", /\b(azure portal|azure devops|azure storage|azure sql|azure app service|azure key vault|azure monitor|application insights|microsoft entra|active directory|cloud service)\b/i],
  ["Dynamics 365 F&O - General Support", /\b(dynamics 365 finance|dynamics 365 finance and operations|dynamics 365 f&o|d365\s?fo|d365fo|finance and operations|dynamics ax|ax 2012|axapta)\b/i],
  ["Other Enterprise Application Support", /\b(enterprise application|business application|erp system|crm system|service management platform|servicenow|salesforce|sap system|oracle application|workday)\b/i],
  ["General IT / Software Support", /\b(application|software|system|portal|website|browser|desktop|client|server|network|computer|device|operating system|windows|microsoft 365|office 365|outlook|teams|sharepoint|onedrive|excel|word|vpn|remote access|technical support|it support|service request|incident|ticket|error|issue|failed|failure|not working|unable to|cannot|unable|bug)\b/i],
  ["Other / Unclassified", /$^/]
];
const ISSUES = [
  ["Slowness", /\b(slow|slowness|latency|lag|laggy|performance|hang|hanging|timeout|time out|taking long|delay)/i],
  ["Access", /\b(access|permission|privilege|role\b|login|log in|sign in|password|locked|authori[sz]|unauthori[sz]|credential|mfa|forbidden|denied)/i]
];
const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
/* ----------------------------------------------------------------------------------- */
const $ = id => document.getElementById(id);
let rows = [], filter = null, rawRows = [], sourceHeaders = [], currentMapping = {}, currentDateOrder = "dmy", importCleanup = {removed:0,pivotMode:false};
let dashboardStats = null, buildGeneration = 0, tablePage = 0;
const TICKET_PAGE_SIZE = 100;

const FIELD_ALIASES = {
  date: ["openedat","openedon","openeddate","opendate","createdat","createdon","createddate","creationdate","datecreated","dateopened","reportedat","reportedon","reporteddate","submittedat","submittedon","raisedat","raisedon","loggedat","receivedat","incidentdate","requestdate","entrydate","eventdate","occurredat","timestamp","datetime","date"],
  priority: ["priority","ticketpriority","prioritylevel","severity","urgency","impactlevel"],
  text: ["shortdescription","shortdesc","subject","summary","title","description","issuedescription","incidentdescription","requestdescription","workdescription","taskdescription","issuetitle","requesttitle","problemdescription","shorttext","briefdescription"],
  number: ["number","ticketnumber","ticketid","incidentnumber","incidentid","requestid","caseid","casenumber","recordid","sysid","id"],
  category: ["category","subcategory","module","service","application","area","component","requesttype","issuetype","worktype"],
  assigned: ["assignedto","assignedtouser","assigneduser","assignee","owner","responsibleperson"]
};

function normalizeHeader(value){
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
function headerTokens(value){
  return String(value ?? "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}
function containsTokenPhrase(header, phrase){
  const tokens=headerTokens(header), target=headerTokens(phrase);
  if (!target.length || target.length>tokens.length) return false;
  for(let i=0;i<=tokens.length-target.length;i++){
    if(target.every((token,j)=>tokens[i+j]===token)) return true;
  }
  return false;
}
function findColumn(headers, aliases){
  // Exact normalized matches first, then complete token phrases. Never use arbitrary substrings:
  // e.g. "Entitlement" must not accidentally match the word "Title".
  const normalized=headers.map(name=>({name,norm:normalizeHeader(name)}));
  for(const alias of aliases){
    const found=normalized.find(h=>h.norm===normalizeHeader(alias));
    if(found) return found.name;
  }
  for(const alias of aliases){
    const found=normalized.find(h=>containsTokenPhrase(h.name,alias));
    if(found) return found.name;
  }
  return "";
}
function dateHeaderScore(header){
  const tokens=headerTokens(header);
  const norm=normalizeHeader(header);
  if(!tokens.length) return -1;
  if (/(created|opened|reported|updated|resolved|closed|requested|assigned|submitted|raised|logged|completed|approved|modified|entered)by$/.test(norm)) return -1;
  if (/(due|target|deadline|birth|dob|expiry|expiration|reminder)/.test(norm)) return -1;
  const has=(...terms)=>terms.some(term=>tokens.includes(term));
  if (has("opened","open") && has("date","at","on","time")) return 135;
  if (has("created","creation") && has("date","at","on","time")) return 130;
  if (has("opened","open")) return 120;
  if (has("created","creation")) return 118;
  if (has("reported","raised","submitted","submission","logged","received","occurred","recorded","entered") && has("date","at","on","time")) return 112;
  if (has("reported","raised","submitted","submission","logged","received","occurred","recorded","entered")) return 105;
  if (has("incident","request","ticket","case") && has("date","at","on","time")) return 95;
  if (has("incident","request","ticket","case") && has("created","opened","reported","raised","submitted")) return 100;
  if (has("updated","modified","resolved","closed","completed") && has("date","at","on","time")) return 70;
  if (has("date","datetime","timestamp")) return 75;
  if (has("resolved","closed","completed","updated","modified") && has("date","at","on","time")) return 55;
  if (has("date","datetime","timestamp","time")) return 35;
  return -1;
}
function isValidTicketDate(d){
  return d instanceof Date && Number.isFinite(d.getTime()) && d.getFullYear() > 1900 && d.getFullYear() < 2200;
}
function makeLocalDate(y, month, day, hour=0, minute=0, second=0){
  const d = new Date(y, month-1, day, hour, minute, second);
  return isValidTicketDate(d) && d.getFullYear()===y && d.getMonth()===month-1 && d.getDate()===day ? d : null;
}
function excelSerialDate(serial){
  if (!Number.isFinite(serial) || serial < 1 || serial > 100000) return null;
  const utc = new Date(Date.UTC(1899,11,30) + Math.round(serial * 86400000));
  return makeLocalDate(utc.getUTCFullYear(),utc.getUTCMonth()+1,utc.getUTCDate(),utc.getUTCHours(),utc.getUTCMinutes(),utc.getUTCSeconds());
}
function inferDateOrder(values){
  let dayFirst=0, monthFirst=0;
  for(const value of values.slice(0,200)){
    const s=String(value ?? "").trim();
    const m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4}|\d{2})(?:\D|$)/);
    if(!m) continue;
    const first=+m[1], second=+m[2];
    if(first>12 && second<=12) dayFirst++;
    else if(second>12 && first<=12) monthFirst++;
  }
  if(monthFirst>dayFirst) return "mdy";
  return "dmy"; // India-friendly default when the file itself is ambiguous.
}
function parseDate(v, order="dmy"){
  if (v instanceof Date) return isValidTicketDate(v) ? v : null;
  if (typeof v === "number") return excelSerialDate(v);
  const s = String(v ?? "").trim();
  if (!s) return null;

  // Unix epoch milliseconds/seconds are accepted only when the value is unmistakably epoch-sized.
  if (/^\d{13}$/.test(s)) {
    const d=new Date(Number(s)); return isValidTicketDate(d)?d:null;
  }
  if (/^\d{10}$/.test(s)) {
    const d=new Date(Number(s)*1000); return isValidTicketDate(d)?d:null;
  }

  let m=s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if(m) return makeLocalDate(+m[1],+m[2],+m[3]);

  // Timezone-qualified ISO timestamps should be interpreted as actual instants.
  if (/^\d{4}-\d{1,2}-\d{1,2}T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(s)){
    const d=new Date(s); return isValidTicketDate(d)?d:null;
  }
  m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:\s*(AM|PM))?)?/i);
  if(m){
    let hour=+(m[4]||0);
    const ampm=(m[7]||"").toUpperCase();
    if(ampm==="PM" && hour<12) hour+=12;
    if(ampm==="AM" && hour===12) hour=0;
    return makeLocalDate(+m[1],+m[2],+m[3],hour,+(m[5]||0),+(m[6]||0));
  }

  m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4}|\d{2})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?\s*(AM|PM)?)?/i);
  if(m){
    const first=+m[1], second=+m[2], yearRaw=+m[3];
    let y=yearRaw<100?(yearRaw>=70?1900+yearRaw:2000+yearRaw):yearRaw;
    let month,day;
    if(first>12){day=first;month=second;}
    else if(second>12){month=first;day=second;}
    else if(order==="mdy"){month=first;day=second;}
    else {day=first;month=second;}
    let hour=+(m[4]||0);
    const ampm=(m[7]||"").toUpperCase();
    if(ampm==="PM" && hour<12) hour+=12;
    if(ampm==="AM" && hour===12) hour=0;
    return makeLocalDate(y,month,day,hour,+(m[5]||0),+(m[6]||0));
  }

  const d=new Date(s);
  return isValidTicketDate(d)?d:null;
}
function isTicketCreatedDateHeader(header){
  const tokens=headerTokens(header);
  if(!tokens.length) return false;
  // These describe a later lifecycle event, a deadline, or a duration—not ticket creation.
  const excluded=new Set([
    "due","target","deadline","expiry","expiration","reminder","birth","dob",
    "updated","modified","resolved","closed","completed","approved","assigned",
    "last","response","resolution","elapsed","duration","effort","hours","hour",
    "hrs","minutes","minute","mins","age","uptime","downtime","sla"
  ]);
  if(tokens.some(token=>excluded.has(token))) return false;
  const accepted=new Set([
    "opened","open","created","creation","reported","raised","submitted","submission",
    "logged","received","occurred","recorded","entered","incident","request","ticket",
    "case","date","datetime","timestamp","time"
  ]);
  return tokens.some(token=>accepted.has(token));
}
function detectDateColumns(headers,rawRows,selectedColumn=""){
  const candidates=[];
  for(const name of headers){
    if(!isTicketCreatedDateHeader(name) && name!==selectedColumn) continue;
    const baseScore=dateHeaderScore(name);
    if(baseScore<0 && name!==selectedColumn) continue;
    const values=(rawRows||[]).map(row=>row?.[name]).filter(value=>
      value!==null && value!==undefined && String(value).trim()!==""
    );
    const order=inferDateOrder(values);
    const validCount=values.reduce((count,value)=>count+(parseDate(value,order)?1:0),0);
    if(validCount===0 && name!==selectedColumn) continue;
    const ratio=values.length?validCount/values.length:0;
    const score=(name===selectedColumn?10000:Math.max(0,baseScore))+ratio*50;
    candidates.push({name,order,score,validCount,nonEmptyCount:values.length});
  }
  candidates.sort((a,b)=>b.score-a.score);
  if(selectedColumn){
    const selected=candidates.find(candidate=>candidate.name===selectedColumn);
    if(selected) return [selected,...candidates.filter(candidate=>candidate.name!==selectedColumn)];
    return [{name:selectedColumn,order:"dmy",score:10000,validCount:0,nonEmptyCount:0},...candidates];
  }
  return candidates;
}
function detectDateColumn(headers,rawRows){
  const candidates=detectDateColumns(headers,rawRows);
  return candidates[0]?.name || "";
}
function resolveTicketDate(record,dateCandidates,selectedColumn,dateOrderOverride="auto"){
  for(const candidate of dateCandidates||[]){
    const order=(candidate.name===selectedColumn && dateOrderOverride && dateOrderOverride!=="auto")
      ? dateOrderOverride
      : candidate.order;
    const parsed=parseDate(record?.[candidate.name],order||"dmy");
    if(parsed) return {date:parsed,source:candidate.name};
  }
  return {date:null,source:""};
}
function detectTextColumn(headers,rawRows){
  const definitions=[
    {label:"short description",weight:140},
    {label:"short desc",weight:135},
    {label:"subject",weight:132},
    {label:"issue description",weight:128},
    {label:"ticket description",weight:126},
    {label:"incident description",weight:124},
    {label:"request description",weight:122},
    {label:"description",weight:120},
    {label:"summary",weight:116},
    {label:"title",weight:112},
    {label:"brief description",weight:108},
    {label:"details",weight:100},
    {label:"work description",weight:96},
    {label:"task description",weight:94}
  ];
  const candidates=[];
  for(const header of headers){
    const norm=normalizeHeader(header);
    const tokens=headerTokens(header);
    if(!norm) continue;
    if(/(assigned|assignee|owner|responsible|requester|requestedby|requestedfor|caller|contact|email|phone|createdby|openedby|resolvedby|closedby|worknotes|comments|journal|group|team)/i.test(norm)) continue;
    let weight=-1;
    for(const item of definitions){
      const aliasNorm=normalizeHeader(item.label);
      if(norm===aliasNorm || containsTokenPhrase(header,item.label)){
        weight=Math.max(weight,item.weight);
      }
    }
    if(weight<0) continue;
    const values=(rawRows||[]).slice(0,200).map(row=>row[header]);
    const nonempty=values.filter(value=>value!==null&&value!==undefined&&String(value).trim()!=="").length;
    const coverage=values.length?nonempty/values.length:0;
    if(coverage===0) continue;
    // Header semantics remain the main signal; coverage breaks ties and avoids an empty preferred column.
    candidates.push({header,score:weight+coverage*45,coverage});
  }
  candidates.sort((a,b)=>b.score-a.score);
  return candidates[0]?.header || "";
}
function detectMapping(headers,rawRows=[]){
  return {
    date:detectDateColumn(headers,rawRows),
    priority:findColumn(headers,FIELD_ALIASES.priority),
    text:detectTextColumn(headers,rawRows),
    number:findColumn(headers,FIELD_ALIASES.number),
    category:findColumn(headers,FIELD_ALIASES.category),
    assigned:findColumn(headers,FIELD_ALIASES.assigned)
  };
}
function populateMappingSelect(id, headers, selected){
  const select = $(id);
  select.innerHTML = "";
  const optional = document.createElement("option");
  optional.value = "";
  optional.textContent = "— Not available / not mapped —";
  select.appendChild(optional);
  headers.forEach(header=>{
    const option = document.createElement("option");
    option.value = header;
    option.textContent = header;
    select.appendChild(option);
  });
  select.value = selected || "";
}
function readMapping(){
  return {
    date:$("map-date").value,
    dateOrder:$("map-date-format").value,
    priority:$("map-priority").value,
    text:$("map-text").value,
    number:$("map-number").value,
    category:$("map-category").value,
    assigned:$("map-assigned").value
  };
}
function parsePriority(value){
  const s=String(value ?? "").trim().toLowerCase();
  if(!s) return "";
  if(/\b(?:p\s?1|priority\s?1|sev(?:erity)?\s?1|critical|urgent|very high)\b/.test(s)) return "P1";
  if(/\b(?:p\s?2|priority\s?2|sev(?:erity)?\s?2|high)\b/.test(s)) return "P2";
  if(/\b(?:p\s?3|priority\s?3|sev(?:erity)?\s?3|moderate|medium)\b/.test(s)) return "P3";
  if(/\b(?:p\s?4|priority\s?4|sev(?:erity)?\s?4|low|minor|lowest)\b/.test(s)) return "P4";
  const numeric=s.match(/^\s*([1-4])(?:\s|[-:.]|$)/);
  if(numeric) return "P"+numeric[1];
  return "";
}
function csvParse(text){
  const out=[]; let row=[], cur="", q=false;
  for (let i=0;i<text.length;i++){
    const c=text[i];
    if (q){ if(c==='"'){ if(text[i+1]==='"'){cur+='"';i++} else q=false } else cur+=c }
    else if (c==='"') q=true;
    else if (c===","){ row.push(cur); cur=""; if(row.length>MAX_TICKET_COLUMNS) throw new Error("CSV exceeds the limit of "+MAX_TICKET_COLUMNS+" columns."); }
    else if (c==="\n"||c==="\r"){
      if(c==="\r"&&text[i+1]==="\n")i++;
      row.push(cur);
      if(row.length>MAX_TICKET_COLUMNS) throw new Error("CSV exceeds the limit of "+MAX_TICKET_COLUMNS+" columns.");
      out.push(row);
      if(out.length>MAX_TICKET_ROWS+1) throw new Error("CSV exceeds the limit of "+MAX_TICKET_ROWS.toLocaleString("en-IN")+" tickets.");
      row=[]; cur="";
    }
    else cur+=c;
  }
  if (cur||row.length){
    row.push(cur);
    if(row.length>MAX_TICKET_COLUMNS) throw new Error("CSV exceeds the limit of "+MAX_TICKET_COLUMNS+" columns.");
    out.push(row);
  }
  if(!out.length) throw new Error("The CSV file is empty.");
  if(out.length>MAX_TICKET_ROWS+1) throw new Error("CSV exceeds the limit of "+MAX_TICKET_ROWS.toLocaleString("en-IN")+" tickets.");
  const h = out.shift().map(x=>x.replace(/^\uFEFF/,"").trim());
  if(!h.length || !h.some(Boolean)) throw new Error("The CSV file needs a header row.");
  return out.filter(r=>r.some(x=>String(x).trim())).map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]||""])));
}
function classifyModule(record,mapping){
  const entries=Object.entries(record||{}).filter(([key,value])=>
    value!==null && value!==undefined && String(value).trim()!=="" &&
    key!==mapping.date && key!==mapping.number &&
    !isBlankOrPlaceholder(value)
  ).map(([key,value])=>({key,value:String(value).trim(),normKey:normalizeHeader(key)}));

  const metadataHeader=/(assignedto|assignee|owner|responsible|requestedby|requestedfor|requester|submitter|caller|contact|email|phone|createdby|openedby|updatedby|modifiedby|resolvedby|closedby|lastupdatedby|assignmentgroup|assignedgroup|approver|employee|analyst|technician|agent|supportuser)/i;
  const descriptiveHeader=/(shortdescription|shortdesc|subject|summary|title|description|details|problem|request|issue|error|message|symptom|failure|worknote|resolution|closurenote|activity|justification|cause|impact|diagnostic|log|comments?)/i;
  const productHeader=/(product|application|platform|software|systemname|servicename|technology|configurationitem|ci\b|offering|businessservice|applicationname)/i;
  const moduleHeader=/(category|subcategory|module|servicearea|businessprocess|process|component|function|functionalarea)/i;
  const groupHeader=/(assignmentgroup|resolvergroup|supportgroup|group|team|queue)/i;

  const descriptive=entries.filter(entry=>descriptiveHeader.test(entry.normKey) && !metadataHeader.test(entry.normKey));
  const productFields=entries.filter(entry=>productHeader.test(entry.normKey) && !metadataHeader.test(entry.normKey));
  const moduleFields=entries.filter(entry=>moduleHeader.test(entry.normKey) && !metadataHeader.test(entry.normKey));
  const groupFields=entries.filter(entry=>groupHeader.test(entry.normKey) && !metadataHeader.test(entry.normKey));
  const supportFields=entries.filter(entry=>!metadataHeader.test(entry.normKey));

  // Every rule is evaluated against one source field at a time.
  // Never join adjacent column values: "Business" + "Central" must not become Business Central.
  const matches=(fields,pattern)=>fields.some(field=>pattern.test(field.value));
  const orderedRules=MODULES.filter(module=>module[0]!=="Other / Unclassified");
  const genericLabels=new Set([
    "Performance & Availability",
    "General IT / Software Support",
    "Other Enterprise Application Support",
    "Environment & Infrastructure",
    "Dynamics 365 F&O - General Support",
    "Dynamics 365 CE / CRM",
    "Dynamics 365 Business Central",
    "Power Platform",
    "Azure & Cloud Services"
  ]);

  // Recognize manufacturing workflows independently from a Production/live environment label.
  const manufacturingRule=MODULES.find(module=>module[0]==="Production Control / Manufacturing");
  if(manufacturingRule && matches([...descriptive,...moduleFields,...supportFields.filter(field=>!descriptive.includes(field))],manufacturingRule[1])){
    return manufacturingRule[0];
  }

  // 1. Specific business module or support function from the ticket narrative.
  const narrativeMatch=orderedRules.find(([label,pattern])=>
    !genericLabels.has(label) && matches(descriptive,pattern)
  );
  if(narrativeMatch) return narrativeMatch[0];

  // 2. Explicit production/live environment mention in a single narrative field.
  if(matches(descriptive,/\b(prod|prd|production|live)\b/i)){
    return "Production Environment / Live System";
  }

  // 3. Specific business module explicitly named in category/module/product context.
  const contextFields=[...moduleFields,...productFields];
  const contextMatch=orderedRules.find(([label,pattern])=>
    !genericLabels.has(label) && matches(contextFields,pattern)
  );
  if(contextMatch) return contextMatch[0];

  // 4. Platform identification is strict and field-scoped.
  // Product/platform labels are returned only when a single source value contains the full identifier.
  const explicitPlatformRules=[
    ["Dynamics 365 Business Central",/\b(?:microsoft\s+)?dynamics\s+365\s+business\s+central\b|\bbusiness\s+central\b|\bdynamics\s+nav\b|\bnavision\b/i],
    ["Dynamics 365 CE / CRM",/\b(?:microsoft\s+)?dynamics\s+365\s+(?:customer engagement|crm|sales|customer service|field service)\b|\bcustomer service hub\b/i],
    ["Dynamics 365 F&O - General Support",/\b(?:microsoft\s+)?dynamics\s+365\s+(?:finance(?:\s+and\s+operations)?|f\s*&\s*o)\b|\bdynamics\s+365\s+finance\s+and\s+operations\b|\bd365\s?fo\b|\bd365fo\b|\bdynamics ax\b|\baxapta\b|\bax 2012\b/i],
    ["SAP ERP Support",/\bSAP\s+(?:S\/4HANA|ECC|ERP|Business One|HANA)\b|\bSAP\b/i],
    ["Oracle Application Support",/\bOracle\s+(?:E-?Business Suite|Fusion|Cloud ERP|Database|Applications?)\b/i],
    ["Salesforce CRM Support",/\bSalesforce(?:\s+(?:Sales|Service|Marketing)\s+Cloud)?\b/i],
    ["ServiceNow ITSM Support",/\bServiceNow\b|\bService\s+Now\b/i],
    ["Workday HCM / ERP Support",/\bWorkday(?:\s+(?:HCM|Financial Management|Payroll))?\b/i],
    ["Atlassian / Jira Support",/\bJira(?:\s+Service Management)?\b|\bConfluence\b|\bAtlassian\b/i],
    ["Power Platform",/\bPower\s+(?:Apps|Automate|Pages|Platform|Virtual Agents)\b|\bCopilot Studio\b/i],
    ["Azure & Cloud Services",/\bAzure\b|\bMicrosoft Entra\b|\bActive Directory\b|\bAWS\b|\bAmazon Web Services\b|\bGoogle Cloud\b|\bGCP\b/i]
  ];
  for(const [label,pattern] of explicitPlatformRules){
    if(matches([...productFields,...descriptive],pattern)) return label;
  }

  // 5. Common operational support areas from descriptive text, then module/group context.
  const descriptiveGeneral=orderedRules.find(([label,pattern])=>
    (genericLabels.has(label) || [
      "Database & Data Platform","Network & Connectivity","Microsoft 365 & Collaboration",
      "Hardware & End-user Support","ITSM & Service Management"
    ].includes(label)) && matches(descriptive,pattern)
  );
  if(descriptiveGeneral) return descriptiveGeneral[0];

  const contextGeneral=orderedRules.find(([label,pattern])=>
    !genericLabels.has(label) && matches([...moduleFields,...groupFields,...productFields],pattern)
  );
  if(contextGeneral) return contextGeneral[0];

  // 6. Fallback to general enterprise/software support only on a positive signal in one field.
  if(matches(supportFields,/\b(erp|crm|enterprise application|business application|servicenow|salesforce|sap|oracle|workday|business central|dynamics nav)\b/i)){
    return "Other Enterprise Application Support";
  }
  if(matches(supportFields,/\b(application|software|system|portal|website|browser|desktop|client|server|network|computer|device|operating system|windows|microsoft 365|office 365|outlook|teams|sharepoint|onedrive|excel|word|vpn|remote access|technical support|it support|service request|incident|ticket|error|issue|failed|failure|not working|unable to|cannot|bug)\b/i)){
    return "General IT / Software Support";
  }
  return "Other / Unclassified";
}

function isBlankOrPlaceholder(value){
  if(value===null || value===undefined) return true;
  const text=String(value).trim();
  return !text || /^(?:-+|—|–|n\/?a|null|undefined|none|\(blank\)|\[empty\])$/i.test(text);
}
function isRepeatedHeaderRecord(record){
  const entries=Object.entries(record||{}).filter(([,value])=>!isBlankOrPlaceholder(value));
  if(entries.length<2) return false;
  const matches=entries.filter(([key,value])=>normalizeHeader(value)===normalizeHeader(key)).length;
  return matches>=2 && matches/entries.length>=0.6;
}
function isExportSummaryRecord(record){
  const values=Object.values(record||{}).filter(value=>!isBlankOrPlaceholder(value)).map(value=>String(value).trim());
  if(!values.length) return true;
  const marker=/^(?:grand\s+total|total(?:\s+(?:records?|tickets?|incidents?|requests?|count))?|records?\s+(?:count|found)|no\s+records?\s+found|end\s+of\s+report|report\s+generated|export\s+completed|generated\s+on|page\s+\d+(?:\s+of\s+\d+)?)\s*[:=-]?$/i;
  const summaryValues=values.filter(value=>marker.test(value));
  const otherValues=values.filter(value=>!marker.test(value));
  if(summaryValues.length && otherValues.length<=5 && otherValues.every(value=>/^[\d,.\s%()-]+$/.test(value))) return true;
  if(values.length===1 && /^(?:row|record)\s*#?\s*\d+$/i.test(values[0])) return true;
  return false;
}
function isPlaceholderTicketIdentity(record,numberColumn){
  if(!numberColumn) return false;
  const value=String(record[numberColumn] ?? "").trim();
  return /^(?:dummy|orphan|sample(?:\s+record)?|test(?:\s+record)?|unknown|undefined|null|none|row\s*#?\s*\d+|record\s*#?\s*\d+)$/i.test(value);
}
function isOrphanTicketRecord(record){
  const headers=Object.keys(record||{});
  const mapping=detectMapping(headers,[record]);
  const valueFor=key=>key?String(record[key]??"").trim():"";
  const idValue=valueFor(mapping.number);
  const subjectValue=valueFor(mapping.text);
  const dateOrder=mapping.date?inferDateOrder([record[mapping.date]]):"dmy";
  const dateValue=mapping.date?parseDate(record[mapping.date],dateOrder):null;

  // A populated subject/title/description is a strong ticket anchor.
  if(subjectValue) return false;

  const metadataHeader=/(?:^|[ _-])(?:assigned\s*to|assignee|owner|responsible(?:\s*person)?|requested\s*by|requested\s*for|requester|submitter|caller|contact|email|phone|created\s*by|opened\s*by|updated\s*by|modified\s*by|resolved\s*by|closed\s*by|last\s*updated\s*by|assignment\s*group|assigned\s*group|group|team|organization|organisation|company|department|approver)(?:$|[ _-])/i;
  const weakHeader=/^(?:status|state|priority|severity|urgency|category|subcategory|type|source|service|serviceinstance|module|workflow|impact|risk|group|team|organization|organisation|company|department)$/i;
  const nonEmptyEntries=headers
    .map(header=>[header,String(record[header]??"").trim()])
    .filter(([,value])=>!isBlankOrPlaceholder(value));
  const businessEntries=nonEmptyEntries.filter(([header])=>
    !metadataHeader.test(header) &&
    header!==mapping.number &&
    header!==mapping.date
  );
  const substantiveEntries=businessEntries.filter(([header])=>
    !weakHeader.test(normalizeHeader(header))
  );

  // ID + a real date, or ID + at least one non-owner field, is a plausible ticket.
  if(dateValue && (idValue || businessEntries.length>=1)) return false;
  if(idValue && !isPlaceholderTicketIdentity(record,mapping.number)){
    return businessEntries.length===0;
  }

  // Preserve custom client schemas with multiple meaningful business fields,
  // or one substantial narrative field, even when no standard ID/description exists.
  if(substantiveEntries.length>=2) return false;
  if(substantiveEntries.length===1 && substantiveEntries[0][1].length>=24) return false;

  return true;
}
function pivotValueMarker(value){
  const normalized=normalizeHeader(value);
  return normalized==="rowlabels" ||
    normalized==="grandtotal" ||
    /^(?:count|sum|average|min|max)of.+/.test(normalized) ||
    /^(?:total|grandtotal)(?:count|records|tickets|incidents|requests)?$/.test(normalized);
}
function isPivotArtifactRow(record){
  return Object.values(record||{}).some(value=>pivotValueMarker(value));
}
function hasValidTicketAnchor(record,mapping){
  const id=mapping.number?String(record[mapping.number]??"").trim():"";
  const realId=id && !isPlaceholderTicketIdentity(record,mapping.number);
  const dateOrder=mapping.date?inferDateOrder([record[mapping.date]]):"dmy";
  const date=mapping.date?parseDate(record[mapping.date],dateOrder):null;
  return !!(realId || date);
}
function cleanTicketRows(raw){
  const source=(raw||[]).filter(record=>record && typeof record==="object" && !Array.isArray(record));
  const headers=Object.keys(source[0]||{});
  const mapping=detectMapping(headers,source);
  // Detect appended spreadsheet pivot/summary blocks once per uploaded file.
  const pivotMode=source.some(record=>isPivotArtifactRow(record)) ||
    headers.some(header=>pivotValueMarker(header));
  const accepted=[];
  let removed=0;
  for(const record of raw||[]){
    if(!record || typeof record!=="object" || Array.isArray(record)){
      removed++;
      continue;
    }
    const hasMeaningfulValue=Object.values(record).some(value=>!isBlankOrPlaceholder(value));
    const numberColumn=findColumn(Object.keys(record),FIELD_ALIASES.number);
    const discard=!hasMeaningfulValue ||
      isRepeatedHeaderRecord(record) ||
      isExportSummaryRecord(record) ||
      isPivotArtifactRow(record) ||
      isPlaceholderTicketIdentity(record,numberColumn);
    if(discard){
      removed++;
      continue;
    }
    // When the same sheet contains a ticket table and a pivot table, rows with no
    // actual ticket ID or opened/created date are pivot labels/counts, not incidents.
    if(pivotMode && !hasValidTicketAnchor(record,mapping)){
      removed++;
      continue;
    }
    if(isOrphanTicketRecord(record)){
      removed++;
      continue;
    }
    accepted.push(record);
  }
  return {rows:accepted,removed,pivotMode};
}
function setRawData(raw){
  if (!Array.isArray(raw) || !raw.length) return fail("No ticket rows were found in this file.");
  if (raw.length > MAX_TICKET_ROWS) return fail("This file exceeds the limit of "+MAX_TICKET_ROWS.toLocaleString("en-IN")+" tickets.");
  sourceHeaders = Object.keys(raw.find(record=>record && typeof record==="object" && !Array.isArray(record)) || {});
  if (!sourceHeaders.length) return fail("The file has no readable column headers. Please check that the first row contains column names.");
  if (sourceHeaders.length > MAX_TICKET_COLUMNS) return fail("This file exceeds the limit of "+MAX_TICKET_COLUMNS+" columns.");

  filter=null; tablePage=0; dashboardStats=null;
  const cleaned=cleanTicketRows(raw);
  importCleanup=cleaned;
  rawRows=cleaned.rows;
  if(!rawRows.length) return fail("No valid ticket rows were found. Blank rows, repeated headers and export summary rows were ignored.");

  currentMapping = detectMapping(sourceHeaders,rawRows);
  populateMappingSelect("map-date",sourceHeaders,currentMapping.date);
  $("map-date-format").value = "auto";
  populateMappingSelect("map-priority",sourceHeaders,currentMapping.priority);
  populateMappingSelect("map-text",sourceHeaders,currentMapping.text);
  populateMappingSelect("map-number",sourceHeaders,currentMapping.number);
  populateMappingSelect("map-category",sourceHeaders,currentMapping.category);
  populateMappingSelect("map-assigned",sourceHeaders,currentMapping.assigned);

  $("mapping").classList.remove("hidden");
  $("drop").classList.add("hidden");
  $("app").classList.remove("hidden");
  $("exp").classList.remove("hidden");
  $("mapping-note").textContent = "Detected " + sourceHeaders.length + " columns. " +
    (currentMapping.date ? "Date: " + currentMapping.date + (currentMapping.dateCandidates?.length>1 ? " (with " + (currentMapping.dateCandidates.length-1) + " alternate created/opened date field(s))" : "") + ". " : "No date field detected. ") +
    (currentMapping.priority ? "Priority: " + currentMapping.priority + ". " : "Priority is optional and was not detected. ") +
    (currentMapping.text ? "Description: " + currentMapping.text + ". " : "No subject/description field detected; Short description will be blank. ") +
    (currentMapping.assigned ? "Assigned To: " + currentMapping.assigned + ". " : "No Assigned To field detected. ") +
    (cleaned.removed ? cleaned.removed + " blank, orphan, repeated-header or export-summary rows ignored." : "No blank or export-summary rows detected.");
  build(rawRows,currentMapping);
}
async function build(raw,mapping){
  if(!raw || !raw.length) return fail("No rows found in that file.");
  const generation=++buildGeneration;
  const cleaned=cleanTicketRows(raw);
  rawRows=cleaned.rows;
  if(!rawRows.length) return fail("No valid ticket rows remain after removing blank, repeated-header and export-summary rows.");
  currentMapping=mapping || detectMapping(Object.keys(rawRows[0]||{}),rawRows);
  currentMapping.dateCandidates=detectDateColumns(Object.keys(rawRows[0]||{}),rawRows,currentMapping.date||"");
  currentDateOrder=currentMapping.date
    ?(currentMapping.dateOrder&&currentMapping.dateOrder!=="auto"
      ?currentMapping.dateOrder
      :inferDateOrder(rawRows.map(row=>row[currentMapping.date]).filter(value=>value!==null&&value!==undefined&&String(value).trim()!=="")))
    :"dmy";

  const totalRows=rawRows.length;
  const builtRows=[];
  const chunkSize=400;
  $("status").textContent="Preparing report: 0 of "+totalRows.toLocaleString("en-IN")+" tickets processed…";
  $("drop").classList.add("hidden");
  $("app").classList.remove("hidden");
  $("exp").classList.remove("hidden");
  $("mapping").classList.remove("hidden");

  for(let start=0;start<totalRows;start+=chunkSize){
    if(generation!==buildGeneration) return;
    const end=Math.min(totalRows,start+chunkSize);
    for(let i=start;i<end;i++){
      const record=rawRows[i];
      const resolvedDate=resolveTicketDate(record,currentMapping.dateCandidates,currentMapping.date,currentMapping.dateOrder||"auto");
      const dateValue=resolvedDate.date;
      const priority=currentMapping.priority?parsePriority(record[currentMapping.priority]):"";
      const description=currentMapping.text?String(record[currentMapping.text]??"").trim():"";
      const assigned=currentMapping.assigned?String(record[currentMapping.assigned]??"").trim():"";
      const module=classifyModule(record,currentMapping);
      const classificationText=Object.entries(record).map(([key,value])=>key+": "+String(value??"")).join(" ");
      const issueTypes=ISSUES.filter(issue=>issue[1].test(classificationText)).map(issue=>issue[0]);
      const dow=dateValue?(dateValue.getDay()+6)%7:null;
      const number=currentMapping.number?String(record[currentMapping.number]??"").trim():"";
      builtRows.push({
        num:number,date:dateValue,dateSource:resolvedDate.source,pri:priority,mod:module,
        iss:issueTypes,dow,wk:dow===null?null:(dow>=5?"Weekend":"Weekday"),
        short:description,assigned
      });
    }
    $("status").textContent="Preparing report: "+end.toLocaleString("en-IN")+" of "+totalRows.toLocaleString("en-IN")+" tickets processed…";
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  if(generation!==buildGeneration) return;

  builtRows.sort((a,b)=>(b.date?b.date.getTime():0)-(a.date?a.date.getTime():0));
  rows=builtRows;
  dashboardStats=calculateDashboardStats(rows);
  filter=null;
  tablePage=0;
  const missingDates=rows.length-dashboardStats.datedCount;
  $("status").textContent=rows.length.toLocaleString("en-IN")+" tickets loaded"+
    (importCleanup.removed?" ("+importCleanup.removed.toLocaleString("en-IN")+" blank, orphan, repeated-header or export-summary rows ignored"+(importCleanup.pivotMode?"; pivot summary rows excluded":"")+")":"")+
    (currentMapping.date
      ?(missingDates?"; "+missingDates.toLocaleString("en-IN")+" rows have missing or unreadable dates.":".")
      :"; no date column mapped, so date-based metrics are unavailable.")+
    (currentMapping.priority?"":" Priority was not provided; counts remain zero.");
  render();
}
function fail(msg){ $("status").textContent = msg; alert(msg); }

function count(items, keyFn){ const m={}; items.forEach(t=>[].concat(keyFn(t)).forEach(k=>m[k]=(m[k]||0)+1)); return m; }
function match(t){ if(!filter) return true;
  return filter.t==="mod"?t.mod===filter.v :
    filter.t==="iss"?t.iss.includes(filter.v) :
    filter.t==="pri"?t.pri===filter.v :
    filter.t==="day"?t.dow!==null && DAYS[t.dow]===filter.v :
    filter.t==="undated"?!t.date :
    filter.t==="wk"?t.wk===filter.v:false; }
function isSel(t,v){ return filter && filter.t===t && filter.v===v; }
function bars(el,t,pairs,peak){
  const max=Math.max(1,...pairs.map(pair=>pair[1]));
  el.innerHTML=pairs.map(([name,value])=>{
    const selected=isSel(t,name);
    const width=(value/max*100)+"%";
    return "<button type='button' class='row "+(selected?"sel ":"")+(peak&&value===max&&value>0?"peak":"")+
      "' data-t='"+t+"' data-v='"+String(name).replace(/'/g,"&#39;")+
      "' aria-pressed='"+selected+"' title='Show "+value+" matching tickets for "+String(name).replace(/'/g,"&#39;")+"'>"+
      "<span class='n'>"+name+"</span><span class='b'><i style='width:"+width+"'></i></span><span class='c'>"+value+"</span></button>";
  }).join("");
}

function calculateDashboardStats(all){
  const total=all.length;
  const dated=all.filter(ticket=>ticket.date instanceof Date && Number.isFinite(ticket.date.getTime()));
  let span=0,average="N/A",peakDay="N/A";
  const dayCounts=Object.create(null);
  if(dated.length){
    let minDay=Infinity,maxDay=-Infinity;
    for(const ticket of dated){
      const dayNumber=Date.UTC(ticket.date.getFullYear(),ticket.date.getMonth(),ticket.date.getDate())/86400000;
      if(dayNumber<minDay) minDay=dayNumber;
      if(dayNumber>maxDay) maxDay=dayNumber;
      const name=DAYS[ticket.dow];
      dayCounts[name]=(dayCounts[name]||0)+1;
    }
    span=Math.max(1,maxDay-minDay+1);
    average=(dated.length/span).toFixed(2);
    peakDay=DAYS.reduce((best,day)=>(dayCounts[day]||0)>(dayCounts[best]||0)?day:best,DAYS[0]);
  }
  const moduleCounts=count(all,ticket=>ticket.mod);
  const issueCounts=count(all,ticket=>ticket.iss);
  const knownNames=MODULES.map(module=>module[0]);
  const modulePairs=Object.keys(moduleCounts).filter(name=>moduleCounts[name]>0)
    .sort((a,b)=>{
      const ai=knownNames.indexOf(a),bi=knownNames.indexOf(b);
      if(ai>=0&&bi>=0) return ai-bi;
      if(ai>=0) return -1;
      if(bi>=0) return 1;
      return a.localeCompare(b);
    }).map(name=>[name,moduleCounts[name]]);
  const issuePairs=ISSUES.map(issue=>[issue[0],issueCounts[issue[0]]||0]);
  const priorityCounts={P1:0,P2:0,P3:0,P4:0};
  let weekdayTotal=0,weekendTotal=0;
  for(const ticket of all){
    if(Object.prototype.hasOwnProperty.call(priorityCounts,ticket.pri)) priorityCounts[ticket.pri]++;
    if(ticket.dow!==null && ticket.dow!==undefined){
      if(ticket.dow>=0&&ticket.dow<=4) weekdayTotal++;
      else if(ticket.dow===5||ticket.dow===6) weekendTotal++;
    }
  }
  const unavailableDateTotal=total-dated.length;
  return {
    total,datedCount:dated.length,span,average,peakDay,modulePairs,issuePairs,
    priorityCounts,weekdayTotal,weekendTotal,unavailableDateTotal,
    dayPairs:DAYS.map(day=>[day,dayCounts[day]||0])
  };
}
function render(){
  const all=rows;
  const stats=dashboardStats || calculateDashboardStats(all);
  $("kpi").innerHTML=
    "<div><b>"+stats.total+"</b><span>Total tickets</span></div>"+
    "<div><b>"+stats.average+"</b><span>"+(stats.datedCount?"Average dated tickets per calendar day across "+stats.span+" days":"Map a date column to calculate daily average")+"</span></div>"+
    "<div><b>"+stats.peakDay+"</b><span>"+(stats.datedCount?"Busiest day":"Date data unavailable")+"</span></div>";
  $("mods").innerHTML="<div id='m1'></div><div id='m2'></div>";
  bars($("m1"),"mod",stats.modulePairs,false);
  bars($("m2"),"iss",stats.issuePairs,false);

  const priorityLabels={P1:"Critical",P2:"High",P3:"Moderate",P4:"Low"};
  $("pri").innerHTML=["P1","P2","P3","P4"].map(priority=>
    "<button type='button' class='"+priority.toLowerCase()+(isSel("pri",priority)?" sel":"")+
    "' data-t='pri' data-v='"+priority+"' aria-pressed='"+isSel("pri",priority)+
    "'><b>"+stats.priorityCounts[priority]+"</b><span>"+priority+" "+priorityLabels[priority]+"</span></button>"
  ).join("");

  $("split").innerHTML=
    "<button type='button' class='"+(isSel("wk","Weekday")?"sel":"")+"' data-t='wk' data-v='Weekday'><b>"+stats.weekdayTotal+"</b><span>Mon to Fri</span></button>"+
    "<button type='button' class='"+(isSel("wk","Weekend")?"sel":"")+"' data-t='wk' data-v='Weekend'><b>"+stats.weekendTotal+"</b><span>Sat and Sun</span></button>"+
    "<button type='button' class='"+(isSel("undated","")?"sel":"")+"' data-t='undated' data-v=''><b>"+stats.unavailableDateTotal+"</b><span>Date unavailable</span></button>";
  $("date-reconciliation-note").textContent=
    "Date coverage: "+(stats.weekdayTotal+stats.weekendTotal).toLocaleString("en-IN")+" of "+
    stats.total.toLocaleString("en-IN")+" tickets dated; "+stats.unavailableDateTotal.toLocaleString("en-IN")+
    " without a usable created/opened date. Weekdays + weekends + unavailable = total tickets.";
  bars($("days"),"day",stats.dayPairs,true);
  $("date-chart-note").textContent=stats.datedCount?"":"No usable opened/created date was detected. Select the correct date column in Client column mapping to populate these metrics.";

  const list=all.filter(match);
  const filterLabel=!filter?"All tickets":
    filter.t==="mod"?"Module: "+filter.v:
    filter.t==="iss"?"Issue type: "+filter.v:
    filter.t==="pri"?"Priority: "+filter.v:
    filter.t==="day"?"Day: "+filter.v:
    filter.t==="wk"?filter.v+" tickets":
    filter.t==="undated"?"Tickets with date unavailable":"Filtered tickets";
  $("tt").textContent=filterLabel+" ("+list.length.toLocaleString("en-IN")+")";
  $("clear").classList.toggle("hidden",!filter);
  const totalPages=Math.max(1,Math.ceil(list.length/TICKET_PAGE_SIZE));
  tablePage=Math.min(Math.max(0,tablePage),totalPages-1);
  const firstIndex=tablePage*TICKET_PAGE_SIZE;
  const pageRows=list.slice(firstIndex,firstIndex+TICKET_PAGE_SIZE);
  const esc=value=>String(value??"").replace(/[&<>"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[char]));
  $("tb").innerHTML=pageRows.map(ticket=>
    "<tr><td>"+esc(ticket.num)+"</td>"+
    "<td>"+(ticket.date?esc(ticket.date.toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"})):"—")+"</td>"+
    "<td>"+(ticket.pri||"—")+"</td>"+
    "<td><span class='tag'>"+esc(ticket.mod)+"</span>"+ticket.iss.map(issue=>"<span class='tag'>"+esc(issue)+"</span>").join("")+"</td>"+
    "<td>"+esc(ticket.assigned)+"</td><td>"+esc(ticket.short)+"</td></tr>"
  ).join("");
  $("page-controls").innerHTML=totalPages>1
    ?"<button type='button' data-page='-1' "+(tablePage===0?"disabled":"")+">Previous</button>"+
      "<span>Page "+(tablePage+1)+" of "+totalPages+" · "+list.length.toLocaleString("en-IN")+" tickets</span>"+
      "<button type='button' data-page='1' "+(tablePage>=totalPages-1?"disabled":"")+">Next</button>"
    :"";
  $("more").textContent=list.length>pageRows.length
    ?"Showing "+(firstIndex+1).toLocaleString("en-IN")+"–"+(firstIndex+pageRows.length).toLocaleString("en-IN")+
      " of "+list.length.toLocaleString("en-IN")+" matching tickets. Export filtered CSV downloads the complete result set."
    :(filter?"Showing all "+list.length.toLocaleString("en-IN")+" matching tickets.":"Showing all "+list.length.toLocaleString("en-IN")+" tickets.");
  window.__list=list;
}

document.addEventListener("click",e=>{
  const pageButton=e.target.closest("[data-page]");
  if(pageButton){
    tablePage=Math.max(0,tablePage+Number(pageButton.dataset.page||0));
    render();
    return;
  }
  const button=e.target.closest("[data-t]");
  if(!button) return;
  const same=filter && filter.t===button.dataset.t && filter.v===button.dataset.v;
  filter=same?null:{t:button.dataset.t,v:button.dataset.v};
  tablePage=0;
  render();
  if(button.dataset.t==="mod" || button.dataset.t==="iss"){
    const target=$("tickets-section");
    if(target) target.scrollIntoView({behavior:"smooth",block:"start"});
  }
});
$("clear").onclick = ()=>{ filter=null; tablePage=0; render(); };
$("exp").onclick = ()=>{
  const q = s=>'"'+String(s).replace(/"/g,'""')+'"';
  const csv = ["Number,Opened,Priority,Area of work,Issue type,Day,Assigned To,Subject / Description"].concat(window.__list.map(t=>[t.num,t.date ? t.date.toISOString() : "",t.pri,t.mod,t.iss.join("; "),t.dow===null ? "" : DAYS[t.dow],t.assigned,t.short].map(q).join(","))).join("\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download = "tickets-filtered.csv"; a.click();
};
function readFile(f){
  if (!f) return;
  const extension = String(f.name || "").split(".").pop().toLowerCase();
  if (!["csv","xlsx","xls"].includes(extension)) return fail("Unsupported file type. Please upload a CSV, XLSX or XLS file.");
  if (!Number.isFinite(f.size) || f.size <= 0) return fail("The selected file is empty or its size cannot be verified.");
  if (f.size > MAX_UPLOAD_BYTES) return fail("The selected file exceeds the 20 MiB upload limit. Please export a smaller report.");
  try {
    if (extension === "csv"){
      const reader = new FileReader();
      reader.onload = ()=>{ try { setRawData(csvParse(reader.result)); } catch(error) { fail("Could not read this CSV file: "+error.message); } };
      reader.onerror = ()=>fail("The CSV file could not be read.");
      reader.readAsText(f);
    } else {
      const reader = new FileReader();
      reader.onload = ()=>{
        try {
          const wb = XLSX.read(reader.result,{type:"array",cellDates:true,sheetRows:MAX_TICKET_ROWS+1});
          const firstSheetName = wb.SheetNames && wb.SheetNames[0];
          if (!firstSheetName) return fail("The Excel workbook does not contain a readable worksheet.");
          const firstSheet = wb.Sheets[firstSheetName];
          if (!firstSheet) return fail("The Excel workbook does not contain a readable worksheet.");
          const fullRef = firstSheet["!fullref"] || firstSheet["!ref"];
          if (!fullRef) return fail("The first worksheet is empty or does not contain a readable range.");
          const range = XLSX.utils.decode_range(fullRef);
          const worksheetRows = range.e.r - range.s.r + 1;
          const worksheetColumns = range.e.c - range.s.c + 1;
          if (worksheetRows > MAX_TICKET_ROWS+1) return fail("The first worksheet exceeds the limit of "+MAX_TICKET_ROWS.toLocaleString("en-IN")+" tickets.");
          if (worksheetColumns > MAX_TICKET_COLUMNS) return fail("The first worksheet exceeds the limit of "+MAX_TICKET_COLUMNS+" columns.");
          setRawData(XLSX.utils.sheet_to_json(firstSheet,{defval:"",raw:true}));
        } catch(error) { fail("Could not read this Excel file: "+error.message); }
      };
      reader.onerror = ()=>fail("The Excel file could not be read.");
      reader.readAsArrayBuffer(f);
    }
  } catch(error) {
    fail("Could not process this file: "+error.message);
  }
}
$("file").onchange = e=>readFile(e.target.files[0]);
$("apply-mapping").onclick = ()=>{
  if (!rawRows.length) return;
  build(rawRows,readMapping());
};
["dragover","dragleave","drop"].forEach(ev=>$("drop").addEventListener(ev,e=>{ e.preventDefault(); $("drop").classList.toggle("over",ev==="dragover"); if(ev==="drop") readFile(e.dataTransfer.files[0]); }));
$("demo").onclick = ()=>{
  const subj = ["Sales order stuck in draft","PO approval failing for vendor","UAT environment not reachable","POS terminal slow at checkout","GL journal posting error","AR customer payment not applied","AP vendor invoice mismatch","Item master attribute missing","Warehouse picking list not generating","Payroll leave balance wrong","System very slow in the morning","User cannot login, access denied","Need role access for finance report"];
  const pr = ["1 - Critical","2 - High","2 - High","3 - Moderate","3 - Moderate","3 - Moderate","4 - Low"];
  const demo = Array.from({length:120},(_,i)=>{ const d=new Date(2026,9,1+Math.floor(Math.random()*30),9+Math.floor(Math.random()*9),0);
    return {Number:"INC"+(100200+i), Opened:d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")+" "+String(d.getHours()).padStart(2,"0")+":00:00", Priority:pr[Math.floor(Math.random()*pr.length)], "Short description":subj[Math.floor(Math.random()*subj.length)]}; });
  setRawData(demo);
};
