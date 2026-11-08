"""Generate the Fieldnotes catalog, product pages and privacy page.

Usage: python3 build_fieldnotes.py <output_dir>
"""
import html
import pathlib
import sys

OUT = pathlib.Path(sys.argv[1])

# Leave empty until the owner chooses a public pilot contact channel.
PILOT_CONTACT_URL = ""

PRODUCTS = [
    {
        "slug": "voicetask", "app": "task", "name": "VoiceTask", "status": ("pilot", "Pilot · preview"),
        "line": "Your to-do list listens.",
        "who": "Freelancers and shop owners who remember jobs while moving between customers, sites and calls.",
        "problem": "Tasks arrive while your hands are busy. By the time you sit down, half of them are gone. Notes apps take too many taps, and typing on the move is slow.",
        "works": [
            "Type or dictate a task in one line",
            "A due date is suggested from words like “tomorrow”, “next week” or “by Friday”, and you confirm or change it",
            "Tick tasks off, undo, and share open tasks to WhatsApp",
            "Works offline for typed entry after the first visit; installable to your home screen",
        ],
        "missing": [
            "No on-device speech model yet. The mic uses your browser’s speech service",
            "Date suggestions understand simple English phrases only. Hindi and Marathi phrases are not supported yet",
            "No reminders or notifications",
            "No sync between phones; tasks live in one browser",
        ],
        "flow": [
            ("Typed task", "Stays in this browser (local storage). PuneStack never receives it."),
            ("Dictated task", "Your browser’s speech service turns audio into text. In Chrome and Edge that means Google or Microsoft receives the audio."),
            ("Shared list", "Only when you tap Share, and only to the app you pick."),
        ],
        "price": "Not set yet. Two packages will be tested with pilot users before anything is charged.",
        "pilot": True,
    },
    {
        "slug": "callrecap", "app": "call", "name": "CallRecap", "status": ("preview", "Early preview"),
        "line": "Every client call becomes a clean follow-up note.",
        "who": "Brokers and sales people who make many short client calls from the car or the shop floor.",
        "problem": "After a call you remember the mood but not the details. Follow-ups slip, and CRM entries never get written.",
        "works": [
            "Type or dictate notes right after the call",
            "A simple recap pulls out a summary, any objection and the next step using keyword rules",
            "Copy the recap for your CRM or WhatsApp",
        ],
        "missing": [
            "It does not record calls. Planned as a voice memo after the call, not call recording",
            "No speaker separation and no on-device speech model",
            "No CRM integration",
        ],
        "flow": [
            ("Typed notes and recaps", "Stay in this browser. PuneStack never receives them."),
            ("Dictated notes", "Your browser’s speech service receives the audio (Google in Chrome, Microsoft in Edge)."),
        ],
        "price": "Not for sale. This is an early preview to gather feedback.",
        "pilot": False,
    },
    {
        "slug": "expenselens", "app": "expense", "name": "ExpenseLens", "status": ("preview", "Early preview"),
        "line": "Keep receipts organised for your CA.",
        "who": "Shop owners and small offices that hand a bag of receipts to their accountant every month.",
        "problem": "Receipts fade, go missing, or sit in a drawer until the CA asks for them. Typing them into a sheet at month-end takes hours.",
        "works": [
            "Enter vendor, amount, date, category and GSTIN for each receipt",
            "See this month’s total at a glance",
            "Export a CSV for your CA",
        ],
        "missing": [
            "No receipt reading (OCR). You type each value yourself",
            "A GSTIN format check does not confirm registration or input-tax-credit eligibility",
            "Not a GST return or accounting system. Your CA must review every entry",
        ],
        "flow": [
            ("Expenses you enter", "Stay in this browser. PuneStack never receives them."),
            ("Receipt photo", "Only its file name is shown; the image is not read, stored or uploaded in this preview."),
            ("CSV export", "Saved by your browser to your device."),
        ],
        "price": "Not for sale. This is an early preview to gather feedback.",
        "pilot": False,
    },
    {
        "slug": "fieldaudit", "app": "audit", "name": "FieldAudit", "status": ("preview", "Early preview"),
        "line": "Site checklists that work without a network.",
        "who": "Site supervisors, store managers and food-safety leads who inspect places with weak or no signal.",
        "problem": "Paper checklists get lost, and most inspection apps stop working in basements, warehouses and remote sites.",
        "works": [
            "Three ready checklists: site safety, retail opening and food safety",
            "Tick items and add findings by typing or dictation",
            "Save the latest audit and share a summary",
            "Tick-box checklists work offline after the first visit",
        ],
        "missing": [
            "No photos and no sync to a team",
            "No custom checklists yet",
            "No on-device speech model. Dictation needs your browser’s speech service and a connection",
        ],
        "flow": [
            ("Checks and findings", "Stay in this browser. PuneStack never receives them."),
            ("Dictated findings", "Your browser’s speech service receives the audio (Google in Chrome, Microsoft in Edge)."),
        ],
        "price": "Not for sale. This is an early preview to gather feedback.",
        "pilot": False,
    },
    {
        "slug": "paperbrief", "app": "paper", "name": "PaperBrief", "status": ("preview", "Early preview"),
        "line": "Spot the clauses to read twice before you sign.",
        "who": "Small business owners asked to sign supplier agreements, leases and service contracts.",
        "problem": "Contracts are long, and the risky lines (auto-renewal, penalties, lock-in) are easy to miss when you are in a hurry.",
        "works": [
            "Paste the text of a document",
            "Get a short extract of its opening sentences",
            "Flags common phrases to review, such as auto-renewal, penalty, lock-in, indemnity and late fee",
        ],
        "missing": [
            "Not legal advice and not a legal review. It can miss important terms",
            "No AI summary: it picks sentences and matches phrases",
            "No reading of photos or PDFs (OCR); paste text only",
        ],
        "flow": [
            ("Pasted text and briefs", "Stay in this browser. PuneStack never receives them."),
        ],
        "price": "Not for sale. Have a qualified lawyer review documents before signing.",
        "pilot": False,
    },
]

def e(s):
    return html.escape(s, quote=True)

def page(title, desc, body, depth):
    up = "../" * depth
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#10271e">
<meta name="robots" content="noindex">
<meta name="description" content="{e(desc)}">
<link rel="icon" href="{up}icon.svg">
<link rel="stylesheet" href="{up}styles.css">
<title>{e(title)}</title>
</head>
<body>
<header class="top"><div class="wrap">
<a class="brand" href="{up}"><span class="brand-mark">P</span>PuneStack Tools</a>
<nav><a href="{up}#tools">Tools</a><a class="hide-sm" href="{up}privacy/">Privacy</a><a class="hide-sm" href="https://punestack.vercel.app/">PuneStack</a><a href="{up}app/">Open app</a></nav>
</div></header>
{body}
<footer><div class="wrap"><span>PuneStack Tools: focused tools for small businesses, part of <a href="https://punestack.vercel.app/">PuneStack</a>. All tools are previews and none are for sale yet.</span><span><a href="{up}privacy/">Privacy</a></span></div></footer>
</body>
</html>
"""

def pilot_cta(name):
    if PILOT_CONTACT_URL:
        return f'<a class="btn lime" href="{e(PILOT_CONTACT_URL)}">Join the {e(name)} pilot</a>'
    return ('<span class="note" style="display:inline-block"><b>Want to join the pilot?</b> '
            'Tell the person who shared this link with you.</span>')

def product_page(p):
    cls, label = p["status"]
    works = "".join(f"<li>{e(x)}</li>" for x in p["works"])
    missing = "".join(f"<li>{e(x)}</li>" for x in p["missing"])
    rows = "".join(f"<tr><td>{e(a)}</td><td>{e(b)}</td></tr>" for a, b in p["flow"])
    cta = f'<a class="btn" href="../app/#{p["app"]}">Try the preview</a>'
    if p["pilot"]:
        cta += pilot_cta(p["name"])
    body = f"""<section class="hero"><div class="wrap">
<div class="crumbs"><a href="../">PuneStack Tools</a> / {e(p['name'])}</div>
<span class="status {cls}">{e(label)}</span>
<h1>{e(p['name'])}: {e(p['line'])}</h1>
<p>{e(p['who'])}</p>
<div class="cta">{cta}</div>
</div></section>
<main><div class="wrap">
<section><h2>The problem</h2><p class="lead">{e(p['problem'])}</p></section>
<section><div class="cols">
<div class="box"><h3>What works in the preview today</h3><ul class="check">{works}</ul></div>
<div class="box"><h3>Not built yet</h3><ul class="cross">{missing}</ul></div>
</div></section>
<section><h2>Where your data goes</h2><p class="lead">No account and no PuneStack server. Here is exactly what happens to what you enter.</p>
<table class="flow"><thead><tr><th>What</th><th>Where it goes</th></tr></thead><tbody>{rows}</tbody></table>
<p style="margin-top:12px;font-size:14px"><a href="../privacy/">Full privacy details</a></p></section>
<section><h2>Price</h2><p class="lead">{e(p['price'])}</p></section>
</div></main>"""
    return page(f"{p['name']}: {p['line']} | PuneStack Tools", f"{p['name']}: {p['line']} Early preview.", body, 1)

def home():
    cards = []
    for p in PRODUCTS:
        cls, label = p["status"]
        cards.append(f"""<article class="card"><span class="status {cls}">{e(label)}</span>
<h3>{e(p['name'])}</h3><p>{e(p['line'])}</p>
<div class="links"><a class="btn secondary" href="{p['slug']}/">Details</a><a class="btn secondary" href="app/#{p['app']}">Try it</a></div></article>""")
    minutebox = """<article class="card feature"><div><span class="status available">Free preview · flagship</span>
<h3 style="margin-top:10px">MinuteBox</h3><p>Meeting minutes and action items, written in your browser. The first tool built this way, and the proof that the approach works.</p></div>
<div class="links" style="margin:0;padding:0"><a class="btn" href="https://minutebox.vercel.app" rel="noopener">Open MinuteBox</a></div></article>"""
    body = f"""<section class="hero"><div class="wrap">
<div class="eyebrow">PuneStack Tools · early previews</div>
<h1>Small tools that each do one back-office job, and keep your work on your phone.</h1>
<p>Focused tools for Indian small businesses. Each one solves a single job, works without an account, and tells you plainly where your data goes.</p>
<div class="pillars">
<div class="pillar"><b>One job per tool</b><span>Not a do-everything assistant. Install only what you need.</span></div>
<div class="pillar"><b>Works on weak networks</b><span>Typed entries keep working offline after your first visit.</span></div>
<div class="pillar"><b>Privacy you can check</b><span>No account and no PuneStack server. Voice input is the exception, and we say so.</span></div>
</div>
</div></section>
<main><div class="wrap">
<section id="tools"><h2>The tools</h2>
<p class="lead">VoiceTask is the first tool being piloted. The others are rough previews shared for feedback. Nothing here is for sale yet.</p>
<div class="cards">{minutebox}{''.join(cards)}</div></section>
<section><div class="note"><b>Honest status.</b> These are previews. The on-device speech and document-reading models planned for these tools are not built yet. Where a tool offers a microphone, your browser’s own speech service does the listening. <a href="privacy/">See exactly where data goes.</a></div></section>
</div></main>
<script>
// Old links pointed at the workspace with a hash (e.g. /#task). Send those to the app.
(function(){{var k=location.hash.slice(1);if(['task','call','expense','audit','paper'].indexOf(k)>-1)location.replace('app/#'+k)}})();
</script>"""
    return page("PuneStack Tools: focused tools for small businesses", "Focused, privacy-first tools for small businesses. Early previews.", body, 0)

def privacy():
    body = """<section class="hero"><div class="wrap">
<div class="crumbs"><a href="../">PuneStack Tools</a> / Privacy</div>
<h1>Where your data goes</h1>
<p>Plain answers, checked against the code. Last reviewed 8 November 2026.</p>
</div></section>
<main><div class="wrap">
<section><h2>The short version</h2>
<ul class="check" style="max-width:720px">
<li>No account, no sign-in, and no PuneStack server that receives what you enter.</li>
<li>Your entries are saved in this browser’s local storage on this device. Clearing your browser data deletes them.</li>
<li>No analytics, advertising or tracking scripts.</li>
</ul></section>
<section><h2>The exceptions</h2>
<table class="flow"><thead><tr><th>Situation</th><th>What leaves your device</th></tr></thead><tbody>
<tr><td>You tap a microphone button</td><td>Your browser’s speech service receives the audio to turn it into text. In Chrome and Edge that is Google or Microsoft, under their privacy terms. Type instead if nothing should leave your device.</td></tr>
<tr><td>You tap Share or Export</td><td>Only what you chose, sent to the app or file you picked.</td></tr>
<tr><td>Loading the website</td><td>Our host, Vercel, receives standard request details (such as your IP address and browser) to deliver the pages.</td></tr>
<tr><td>Speech test lab page</td><td>Downloads a speech model from Hugging Face and code from jsDelivr once, then runs on your device. Your audio is not uploaded. This page is only for testing.</td></tr>
</tbody></table></section>
<section><h2>Delete your PuneStack Tools data</h2>
<p class="lead">Removes every task, recap, expense, audit and brief that PuneStack Tools saved in this browser. This cannot be undone.</p>
<button class="btn secondary" id="wipe" type="button">Delete my PuneStack Tools data in this browser</button>
<p id="wipe-msg" role="status" style="font-size:14px;color:var(--muted)"></p>
</section>
</div></main>
<script>
document.getElementById('wipe').addEventListener('click',function(){
  var b=this,msg=document.getElementById('wipe-msg');
  if(b.dataset.armed!=='1'){b.dataset.armed='1';b.textContent='Tap again to confirm';msg.textContent='This removes all PuneStack Tools entries from this browser.';return}
  var n=0;try{Object.keys(localStorage).forEach(function(k){if(k.indexOf('fieldnotes_')===0){localStorage.removeItem(k);n++}})}catch(err){}
  b.dataset.armed='';b.textContent='Delete my PuneStack Tools data in this browser';msg.textContent=n?('Deleted '+n+' saved item group'+(n===1?'':'s')+'.'):'Nothing was stored in this browser.';
});
</script>"""
    return page("Privacy | PuneStack Tools", "Where PuneStack Tools data goes, in plain language.", body, 1)

(OUT / "index.html").write_text(home())
(OUT / "privacy" / "index.html").write_text(privacy())
for p in PRODUCTS:
    (OUT / p["slug"] / "index.html").write_text(product_page(p))
print("generated", 2 + len(PRODUCTS), "pages")
