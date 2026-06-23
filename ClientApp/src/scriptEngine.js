// ── Built-in dynamic variable generators ─────────────────────────────────────

const _pick = arr => arr[Math.floor(Math.random() * arr.length)];
const _rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const _pad2 = n => String(n).padStart(2, "0");

const _FIRST = ["Alice","Bob","Carol","David","Emma","Frank","Grace","Henry","Isabel","James","Kate","Liam","Maria","Noah","Olivia","Paul","Quinn","Rachel","Samuel","Tara","Uma","Victor","Wendy","Xavier","Yasmin","Zach","Aria","Blake","Chris","Dana","Eli","Fiona","George","Hannah","Ivan","Julia"];
const _LAST  = ["Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Wilson","Moore","Taylor","Anderson","Thomas","Jackson","White","Harris","Martin","Thompson","Robinson","Clark","Lewis","Walker","Hall","Allen","King","Wright","Scott","Green","Adams","Baker","Nelson","Carter","Mitchell","Perez"];
const _CITIES = ["New York","London","Tokyo","Paris","Sydney","Berlin","Toronto","Singapore","Dubai","Amsterdam","Seoul","Barcelona","Mumbai","Chicago","Los Angeles","Melbourne","Vienna","Prague","Lisbon","Stockholm","São Paulo","Cairo","Lagos","Istanbul","Jakarta","Bangkok","Nairobi","Dublin","Helsinki","Zurich"];
const _COUNTRIES = ["United States","United Kingdom","Japan","France","Germany","Australia","Canada","Brazil","India","China","Italy","Spain","Mexico","South Korea","Netherlands","Sweden","Norway","Switzerland","Poland","Argentina"];
const _CC = ["US","GB","JP","FR","DE","AU","CA","BR","IN","CN","IT","ES","MX","KR","NL","SE","NO","CH","PL","AR","SG","ZA","NG","TR","ID","TH","KE","IE","FI","AE"];
const _ADJ = ["quick","bright","strong","calm","fresh","smart","bold","keen","pure","deep","fine","grand","swift","free","dark","pale","wild","warm","cool","vast","sleek","crisp","lean","clear","sharp","light","open","safe","live","fast"];
const _NOUNS = ["data","user","item","record","event","task","token","value","query","state","model","type","list","map","key","set","node","path","form","rule","session","config","message","report","profile","order","product","invoice","request","response"];

function _uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function _password() {
  const pool = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  return Array.from({ length: 14 }, () => pool[Math.floor(Math.random() * pool.length)]).join("");
}

export const BUILTIN_VARIABLES = {
  guid:              _uuid,
  randomUUID:        _uuid,
  timestamp:         () => String(Math.floor(Date.now() / 1000)),
  isoTimestamp:      () => new Date().toISOString(),
  randomObjectId:    () => Array.from({length:24}, () => "0123456789abcdef"[Math.floor(Math.random()*16)]).join(""),
  randomInt:         () => String(_rand(0, 1000)),
  randomFloat:       () => (_rand(0, 100000) / 100).toFixed(2),
  randomBoolean:     () => String(Math.random() < 0.5),
  randomAlphaNumeric:() => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)],
  randomHexaDecimal: () => `0x${_rand(0, 255).toString(16).padStart(2, "0")}`,
  randomFirstName:   () => _pick(_FIRST),
  randomLastName:    () => _pick(_LAST),
  randomFullName:    () => `${_pick(_FIRST)} ${_pick(_LAST)}`,
  randomEmail:       () => `${_pick(_FIRST).toLowerCase()}.${_pick(_LAST).toLowerCase()}${_rand(1, 99)}@${_pick(["example","test","sample","mail"])}.${_pick(["com","net","org"])}`,
  randomUserName:    () => `${_pick(_FIRST).toLowerCase()}${_pick(_LAST).toLowerCase()}${_rand(1, 999)}`,
  randomPassword:    _password,
  randomPhoneNumber: () => `+1-${_rand(200,999)}-${_rand(100,999)}-${String(_rand(0,9999)).padStart(4,"0")}`,
  randomJobTitle:    () => `${_pick(["Senior","Junior","Lead","Principal","Staff","Associate"])} ${_pick(["Engineer","Developer","Designer","Analyst","Manager","Architect","Consultant"])}`,
  randomWord:        () => _pick(_NOUNS),
  randomWords:       () => `${_pick(_ADJ)} ${_pick(_NOUNS)}`,
  randomLoremIpsum:  () => "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
  randomAbbreviation:() => _pick(["API","URL","JSON","XML","HTML","CSS","JWT","OAuth","SDK","CLI","HTTP","REST","CRUD","UUID","SQL","GQL","SSO","RBAC","2FA","OTP"]),
  randomColor:       () => _pick(["red","green","blue","yellow","purple","orange","pink","cyan","magenta","brown","black","white","gray","violet","indigo","teal","lime","amber"]),
  randomHexColor:    () => `#${_rand(0, 0xffffff).toString(16).padStart(6, "0")}`,
  randomIP:          () => `${_rand(1,254)}.${_rand(0,255)}.${_rand(0,255)}.${_rand(1,254)}`,
  randomIPV6:        () => Array.from({length:8}, () => _rand(0, 0xffff).toString(16).padStart(4,"0")).join(":"),
  randomMACAddress:  () => Array.from({length:6}, () => _rand(0, 255).toString(16).padStart(2,"0")).join(":"),
  randomUrl:         () => `https://${_pick(["api","app","www","dev"])}.${_pick(_ADJ)}.${_pick(["com","io","net"])}/${_pick(_NOUNS)}`,
  randomDomainName:  () => `${_pick(_ADJ)}.${_pick(["com","io","net","org","dev","app"])}`,
  randomDomainSuffix:() => _pick(["com","io","net","org","dev","app","co","ai","cloud"]),
  randomProtocol:    () => _pick(["http","https"]),
  randomCity:        () => _pick(_CITIES),
  randomCountry:     () => _pick(_COUNTRIES),
  randomCountryCode: () => _pick(_CC),
  randomLatitude:    () => (Math.random() * 180 - 90).toFixed(6),
  randomLongitude:   () => (Math.random() * 360 - 180).toFixed(6),
  randomCurrencyCode:  () => _pick(["USD","EUR","GBP","JPY","AUD","CAD","CHF","CNY","INR","BRL","SGD","HKD","NOK","SEK","DKK","NZD","MXN","ZAR","KRW","AED"]),
  randomCurrencyName:  () => _pick(["US Dollar","Euro","Pound Sterling","Japanese Yen","Australian Dollar","Canadian Dollar","Swiss Franc","Chinese Yuan","Indian Rupee","Brazilian Real"]),
  randomCurrencySymbol:() => _pick(["$","€","£","¥","₹","R$","Fr","₩","₪","₦","₴","₿","₺","฿","₱"]),
  randomFileName:     () => `${_pick(["data","report","export","upload","file","document","backup","archive"])}_${_rand(1,999)}.${_pick(["json","csv","txt","pdf","png","xml","xlsx","zip"])}`,
  randomFileExtension:() => _pick(["json","csv","txt","pdf","png","jpg","xml","zip","html","yaml","md","mp4","mp3","svg"]),
  randomFileType:     () => _pick(["text","image","document","video","audio","spreadsheet","archive","code","font"]),
  randomDateFuture:  () => new Date(Date.now() + Math.random() * 365 * 86400000).toISOString(),
  randomDatePast:    () => new Date(Date.now() - Math.random() * 365 * 86400000).toISOString(),
  randomDateRecent:  () => new Date(Date.now() - Math.random() *   7 * 86400000).toISOString(),
};

export const BUILTIN_CATEGORIES = [
  { label: "Time & IDs",  items: [
    { name: "$guid",             desc: "Random UUID v4" },
    { name: "$randomUUID",       desc: "Random UUID v4 (alias)" },
    { name: "$timestamp",        desc: "Unix timestamp in seconds" },
    { name: "$isoTimestamp",     desc: "ISO 8601 datetime string" },
    { name: "$randomObjectId",   desc: "24-char hex ID (MongoDB-style)" },
  ]},
  { label: "Numbers",     items: [
    { name: "$randomInt",          desc: "Integer 0–1000" },
    { name: "$randomFloat",        desc: "Float 0.00–1000.00" },
    { name: "$randomBoolean",      desc: "true or false" },
    { name: "$randomAlphaNumeric", desc: "Single alphanumeric character" },
    { name: "$randomHexaDecimal",  desc: "Hex byte (0x00–0xff)" },
  ]},
  { label: "Person",      items: [
    { name: "$randomFirstName",   desc: "Random first name" },
    { name: "$randomLastName",    desc: "Random last name" },
    { name: "$randomFullName",    desc: "Random full name" },
    { name: "$randomEmail",       desc: "Random email address" },
    { name: "$randomUserName",    desc: "Random username" },
    { name: "$randomPassword",    desc: "Random 14-char password" },
    { name: "$randomPhoneNumber", desc: "Random US phone number" },
    { name: "$randomJobTitle",    desc: "Random job title" },
  ]},
  { label: "Text",        items: [
    { name: "$randomWord",        desc: "Random single word" },
    { name: "$randomWords",       desc: "Random two-word phrase" },
    { name: "$randomLoremIpsum",  desc: "Lorem ipsum sentence" },
    { name: "$randomAbbreviation",desc: "Random tech abbreviation" },
  ]},
  { label: "Color",       items: [
    { name: "$randomColor",    desc: "Color name (red, blue, …)" },
    { name: "$randomHexColor", desc: "Hex color (#rrggbb)" },
  ]},
  { label: "Network",     items: [
    { name: "$randomIP",           desc: "Random IPv4 address" },
    { name: "$randomIPV6",         desc: "Random IPv6 address" },
    { name: "$randomMACAddress",   desc: "Random MAC address" },
    { name: "$randomUrl",          desc: "Random HTTPS URL" },
    { name: "$randomDomainName",   desc: "Random domain name" },
    { name: "$randomDomainSuffix", desc: "Random TLD (.com, .io…)" },
    { name: "$randomProtocol",     desc: "http or https" },
  ]},
  { label: "Location",    items: [
    { name: "$randomCity",        desc: "Random city name" },
    { name: "$randomCountry",     desc: "Random country name" },
    { name: "$randomCountryCode", desc: "Random ISO 2-letter country code" },
    { name: "$randomLatitude",    desc: "Random latitude (±90)" },
    { name: "$randomLongitude",   desc: "Random longitude (±180)" },
  ]},
  { label: "Finance",     items: [
    { name: "$randomCurrencyCode",   desc: "Currency code (USD, EUR…)" },
    { name: "$randomCurrencyName",   desc: "Currency full name" },
    { name: "$randomCurrencySymbol", desc: "Currency symbol ($, €…)" },
  ]},
  { label: "File",        items: [
    { name: "$randomFileName",      desc: "Random filename with extension" },
    { name: "$randomFileExtension", desc: "Random file extension" },
    { name: "$randomFileType",      desc: "Random file type category" },
  ]},
  { label: "Dates",       items: [
    { name: "$randomDateFuture", desc: "ISO date in the next 12 months" },
    { name: "$randomDatePast",   desc: "ISO date in the past 12 months" },
    { name: "$randomDateRecent", desc: "ISO date within the past 7 days" },
  ]},
];

// ── Script execution engine ───────────────────────────────────────────────────

export function formatLogArgs(args) {
  return args.map(arg => {
    if (arg === null) return "null";
    if (arg === undefined) return "undefined";
    if (typeof arg === "object") { try { return JSON.stringify(arg, null, 2); } catch { return String(arg); } }
    return String(arg);
  }).join(" ");
}

export function pmExpect(actual) {
  const fail = msg => { throw new Error(msg); };
  const fmt = v => { try { return JSON.stringify(v); } catch { return String(v); } };
  const chain = {};
  ["to", "be", "been", "have", "that", "which", "and", "is"].forEach(k => Object.defineProperty(chain, k, { get: () => chain }));
  Object.defineProperty(chain, "ok",        { get: () => { if (!actual) fail(`Expected ${fmt(actual)} to be truthy`); return chain; } });
  Object.defineProperty(chain, "null",      { get: () => { if (actual !== null) fail(`Expected ${fmt(actual)} to be null`); return chain; } });
  Object.defineProperty(chain, "undefined", { get: () => { if (actual !== undefined) fail(`Expected ${fmt(actual)} to be undefined`); return chain; } });
  Object.defineProperty(chain, "true",      { get: () => { if (actual !== true) fail(`Expected ${fmt(actual)} to be true`); return chain; } });
  Object.defineProperty(chain, "false",     { get: () => { if (actual !== false) fail(`Expected ${fmt(actual)} to be false`); return chain; } });
  Object.defineProperty(chain, "empty",     { get: () => { if (actual?.length !== 0 && Object.keys(actual ?? {}).length !== 0) fail(`Expected ${fmt(actual)} to be empty`); return chain; } });
  chain.equal = chain.eq = v => { if (actual !== v) fail(`Expected ${fmt(actual)} to equal ${fmt(v)}`); return chain; };
  chain.eql = chain.deep = v => { if (JSON.stringify(actual) !== JSON.stringify(v)) fail(`Expected deep equality: ${fmt(actual)} vs ${fmt(v)}`); return chain; };
  chain.include = chain.contain = v => {
    if (typeof actual === "string") { if (!actual.includes(v)) fail(`Expected "${actual}" to include "${v}"`); }
    else if (Array.isArray(actual)) { if (!actual.includes(v)) fail(`Expected array to include ${fmt(v)}`); }
    else fail("include() requires a string or array");
    return chain;
  };
  chain.above = chain.gt = n => { if (!(actual > n)) fail(`Expected ${actual} to be above ${n}`); return chain; };
  chain.below = chain.lt = n => { if (!(actual < n)) fail(`Expected ${actual} to be below ${n}`); return chain; };
  chain.least = chain.gte = n => { if (!(actual >= n)) fail(`Expected ${actual} to be at least ${n}`); return chain; };
  chain.most  = chain.lte = n => { if (!(actual <= n)) fail(`Expected ${actual} to be at most ${n}`); return chain; };
  chain.a = chain.an = type => {
    const t = Array.isArray(actual) ? "array" : typeof actual;
    if (t !== type) fail(`Expected ${fmt(actual)} to be a ${type}, got ${t}`);
    return chain;
  };
  chain.property = key => { if (!(key in Object(actual))) fail(`Expected object to have property "${key}"`); return chain; };
  chain.lengthOf = n => { if (actual?.length !== n) fail(`Expected length ${n}, got ${actual?.length}`); return chain; };
  chain.match = re => { if (!re.test(actual)) fail(`Expected "${actual}" to match ${re}`); return chain; };
  chain.oneOf = arr => { if (!arr.includes(actual)) fail(`Expected ${fmt(actual)} to be one of ${fmt(arr)}`); return chain; };
  return chain;
}

export function buildScriptConsole(logs) {
  return {
    log:   (...args) => logs.push({ level: "log",   text: formatLogArgs(args) }),
    error: (...args) => logs.push({ level: "error", text: formatLogArgs(args) }),
    warn:  (...args) => logs.push({ level: "warn",  text: formatLogArgs(args) }),
    info:  (...args) => logs.push({ level: "log",   text: formatLogArgs(args) }),
  };
}

export const _AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

export function buildSendRequestFn(send, logs, pendingRequests) {
  return (spec, callback) => {
    const raw = send(spec)
      .then(response => { callback?.(null, response); return response; })
      .catch(err => {
        if (callback) { callback(err, null); return null; }
        throw err;
      });
    pendingRequests.push(raw.catch(() => {}));
    return raw;
  };
}

export function buildScriptSendResponse(result) {
  return {
    status: result.status,
    code: result.status,
    statusText: result.statusText ?? "",
    responseTime: result.durationMs,
    text: () => result.body || "",
    json: () => { try { return JSON.parse(result.body); } catch { throw new Error("Response body is not valid JSON."); } },
    headers: {
      get: name => result.headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? null,
      has: name => result.headers?.some(h => h.name.toLowerCase() === name.toLowerCase()) ?? false,
    }
  };
}

export async function runPreRequestScript(script, variables, collectionVariables, send) {
  const logs = [];
  const varChanges = {};
  const colVarChanges = {};
  const pendingRequests = [];
  const envApi = {
    get: name => variables.find(v => v.name === name)?.value ?? null,
    set: (name, value) => { varChanges[String(name)] = String(value ?? ""); }
  };
  const colVarApi = {
    get: name => collectionVariables.find(v => v.name === name)?.value ?? null,
    set: (name, value) => { colVarChanges[String(name)] = String(value ?? ""); }
  };
  const pm = {
    environment: envApi,
    variables: envApi,
    collectionVariables: colVarApi,
    sendRequest: buildSendRequestFn(send, logs, pendingRequests),
  };
  try {
    await new _AsyncFunction("pm", "console", script)(pm, buildScriptConsole(logs));
    await Promise.allSettled(pendingRequests);
  } catch (error) {
    logs.push({ level: "error", text: `Script error: ${error.message}` });
  }
  return { varChanges, colVarChanges, logs };
}

export async function runPostResponseScript(script, variables, collectionVariables, result, send) {
  const logs = [];
  const varChanges = {};
  const colVarChanges = {};
  const tests = [];
  const pendingRequests = [];
  const envApi = {
    get: name => variables.find(v => v.name === name)?.value ?? null,
    set: (name, value) => { varChanges[String(name)] = String(value ?? ""); }
  };
  const colVarApi = {
    get: name => collectionVariables.find(v => v.name === name)?.value ?? null,
    set: (name, value) => { colVarChanges[String(name)] = String(value ?? ""); }
  };
  const pm = {
    environment: envApi,
    variables: envApi,
    collectionVariables: colVarApi,
    response: buildScriptSendResponse(result),
    test: (name, fn) => {
      try { fn(); tests.push({ name, passed: true }); }
      catch (error) { tests.push({ name, passed: false, error: error.message }); }
    },
    expect: pmExpect,
    sendRequest: buildSendRequestFn(send, logs, pendingRequests),
  };
  try {
    await new _AsyncFunction("pm", "console", script)(pm, buildScriptConsole(logs));
    await Promise.allSettled(pendingRequests);
  } catch (error) {
    logs.push({ level: "error", text: `Script error: ${error.message}` });
  }
  return { varChanges, colVarChanges, logs, tests };
}
