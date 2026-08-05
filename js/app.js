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

function buildResultHtml(r) {
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

  if (!grossIncome || grossIncome <= 0) {
    return;
  }

  const input = { employmentType, grossIncome, age40to64, dependents, expenseRate };
  const result = calcDonationLimit(input);

  resultBody.innerHTML = buildResultHtml(result);
  introSection.hidden = true;
  resultSection.hidden = false;
});

btnRestart.addEventListener("click", () => {
  resultSection.hidden = true;
  introSection.hidden = false;
});
