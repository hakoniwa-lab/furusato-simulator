/*
 * フォームの入力受付・DOM描画。計算ロジックは calculate.js に委譲する。
 */

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function yen(n) {
  return Math.round(n).toLocaleString("ja-JP") + "円";
}

const form = document.getElementById("calc-form");
const employmentTypeSelect = document.getElementById("employment_type");
const expenseRateField = document.getElementById("expense-rate-field");
const resultSection = document.getElementById("screen-result");
const introSection = document.getElementById("screen-intro");
const resultBody = document.getElementById("result-body");
const btnRestart = document.getElementById("btn-restart");

function toggleExpenseRateField() {
  expenseRateField.hidden = employmentTypeSelect.value !== "self_employed";
}

employmentTypeSelect.addEventListener("change", toggleExpenseRateField);
toggleExpenseRateField();

function buildCrossLinkBanners() {
  const banners = [
    { href: "../takehome-calculator/", text: "手取り年収も計算してみる →" },
    { href: "../insurance-checker/", text: "必要な保障を保険診断で確認する →" },
    { href: "../subsidy-checker/", text: "使える給付金・補助金も給付金診断で確認する →" },
    { href: "../sidejob-tax-simulator/", text: "副業をしている場合は控除上限額が変わることがあります。副業の税金シミュレーターで確認する →" },
  ];
  return banners.map((b) => `<a class="cross-link-banner" href="${escapeHtml(b.href)}">${escapeHtml(b.text)}</a>`).join("");
}

/* 広告(A8.net、2026-10-25 に即時提携)。au PAY ふるさと納税・ふるさと本舗。素材の文言は変えない */
const OFFERS = [
  ["4BEOXO+GC8JPU+54OC+5YJRM", "www14", "au PAY ふるさと納税"],
  ["4BEOXO+GDFEXE+5IMU+5YRHE", "www13", "ふるさと本舗"],
];

function buildOfferHtml() {
  const links = OFFERS.map(([mat, host, text]) =>
    `<a class="result-card__link result-card__link--offer" href="https://px.a8.net/svt/ejp?a8mat=${mat}" target="_blank" rel="nofollow sponsored noopener">${escapeHtml(text)}<span class="badge badge--pr">PR</span></a><img border="0" width="1" height="1" src="https://${host}.a8.net/0.gif?a8mat=${mat}" alt="">`
  ).join("");
  return `<div class="art-cta">
      <p>上限額が分かったら、返礼品はふるさと納税サイトで探せます。サイトによって扱う自治体や返礼品が違うので、見比べてから選ぶと安心です。</p>
      <div class="art-cta__links">${links}</div>
    </div>`;
}

function buildIdecoHtml(r) {
  if (!(r.ideco > 0)) return "";
  const diff = r.limitWithoutIdeco - r.donationLimit;
  return `<div class="result-section">
      <h3>iDeCoの掛金の分</h3>
      <p>掛金${escapeHtml(yen(r.ideco))}が所得控除になるので、上限の目安は<strong>約${escapeHtml(yen(diff))}下がっています</strong>(掛金がない場合は${escapeHtml(yen(r.limitWithoutIdeco))})。</p>
    </div>`;
}

function buildLoanHtml(r, h, opt) {
  if (!h) return "";
  const head = `<p>所得税(概算)は${escapeHtml(yen(h.incomeTaxBeforeLoan))}で、住宅ローン控除のうち所得税から引けるのは${escapeHtml(yen(h.loanFromIncomeTax))}です。引ききれない分は、住民税から${escapeHtml(yen(h.loanCapResident))}まで引かれます。</p>`;
  let body;
  if (h.lostAtLimit <= 300) {
    body = `<p>上限まで寄附しても、<strong>住宅ローン控除の影響はほぼありません</strong>(控除しきれない額は約${escapeHtml(yen(h.lostAtLimit))})。</p>`;
  } else {
    body = `<p class="result-warn">上限まで寄附すると、<strong>約${escapeHtml(yen(h.lostAtLimit))}が控除しきれません</strong>。実質の自己負担は2,000円ではなく、約${escapeHtml(yen(2000 + h.lostAtLimit))}になります。</p>`;
    if (h.lostIfOnestop !== null && h.lostIfOnestop <= 300) {
      body += `<p>ワンストップ特例を使える年(住宅ローン控除の2年目以降で、ほかに確定申告の理由がない場合)なら、控除しきれない額は約${escapeHtml(yen(h.lostIfOnestop))}です。確定申告では、寄附金控除で所得税の課税所得が減り、住民税から引ける住宅ローン控除の上限(課税総所得金額等の${opt.capRate === 0.07 ? "7" : "5"}%)も下がるためです。</p>`;
    }
  }
  return `<div class="result-section">
      <h3>住宅ローン控除との関係</h3>
      ${head}${body}
      <p class="form-help">住民税は、住宅ローン控除を寄附金の控除より先に引きます(練馬区の案内)。住宅ローン控除の額は<a href="../subsidy-checker/guide/jutaku-loan-kojo/">住宅ローン控除の計算シミュレーター</a>でも確かめられます。</p>
    </div>`;
}

function buildResultHtml(r, h, opt) {
  if (r.donationLimit <= 0) {
    return `
      <div class="result-headline">
        <p class="result-headline__label">寄附上限額の目安</p>
        <p class="result-headline__value">0円</p>
        <p class="result-headline__sub">住民税所得割額が発生しないため、控除の対象になりません</p>
      </div>
    `;
  }

  return `
    <div class="result-headline">
      <p class="result-headline__label">実質2,000円で寄附できる上限額の目安</p>
      <p class="result-headline__value">${escapeHtml(yen(r.donationLimit))}</p>
      <p class="result-headline__sub">これを超える寄附分は、自己負担が2,000円を超えます</p>
    </div>
    <div class="result-breakdown">
      <div class="result-row"><span>額面年収</span><span>${escapeHtml(yen(r.grossIncome))}</span></div>
      <div class="result-row"><span>住民税所得割額(概算)</span><span>${escapeHtml(yen(r.residentTaxIncomeBased))}</span></div>
      <div class="result-row"><span>所得税の限界税率(概算)</span><span>${escapeHtml(String(r.marginalRate * 100))}%</span></div>
    </div>
    ${buildIdecoHtml(r)}
    ${buildLoanHtml(r, h, opt)}
    ${buildOfferHtml()}
    <p class="result-links">寄附の期限(12月31日)とワンストップ特例の申請期限は<a href="guide/itsumade-2026/">ふるさと納税は2026年分いつまで？</a>にまとめています。</p>
    <div class="result-cross-links">
      ${buildCrossLinkBanners()}
    </div>
  `;
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const formData = new FormData(form);
  const employmentType = formData.get("employment_type");
  const grossIncome = Number(formData.get("gross_income"));
  const age40to64 = formData.get("age40to64") === "on";
  const dependents = Number(formData.get("dependents") || 0);
  const expenseRate = Number(formData.get("expense_rate") || 30) / 100;
  const ideco = Math.max(0, Number(formData.get("ideco") || 0));
  const loanCredit = Math.max(0, Number(formData.get("loan_credit") || 0));
  const cap7 = formData.get("loan_cap") === "7";
  const opt = { credit: loanCredit, filing: formData.get("filing") === "return" ? "return" : "onestop",
    capRate: cap7 ? 0.07 : 0.05, capMax: cap7 ? 136500 : 97500 };

  if (!grossIncome || grossIncome <= 0) {
    return;
  }

  const input = { employmentType, grossIncome, age40to64, dependents, expenseRate, ideco };
  const result = calcDonationLimit(input);
  const loan = housingLoanCheck(result, opt);

  resultBody.innerHTML = buildResultHtml(result, loan, opt);
  introSection.hidden = true;
  resultSection.hidden = false;
});

btnRestart.addEventListener("click", () => {
  resultSection.hidden = true;
  introSection.hidden = false;
});
