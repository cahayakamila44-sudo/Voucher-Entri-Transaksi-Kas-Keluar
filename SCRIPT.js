// =========================================================
// GLOBAL VARIABLES
// =========================================================

let supabaseClient = null;
let chartOfAccounts = [];

// Untuk perhitungan nominal secara aman
const INT_MULTIPLIER = 100;


// =========================================================
// INITIALIZATION
// =========================================================

window.addEventListener("DOMContentLoaded", function () {

    // Tanggal default = hari ini
    document.getElementById("trx_date").value =
        new Date().toISOString().split("T")[0];


    // Ambil konfigurasi Supabase dari localStorage
    const savedUrl =
        localStorage.getItem("sia_supabase_url") || "";

    const savedKey =
        localStorage.getItem("sia_supabase_key") || "";


    if (savedUrl && savedKey) {

        document.getElementById(
            "input-supabase-url"
        ).value = savedUrl;

        document.getElementById(
            "input-supabase-key"
        ).value = savedKey;

        initSupabase(savedUrl, savedKey);

    } else {

        updateConnectionStatus(
            "error",
            "Konfigurasi Supabase Diperlukan"
        );
    }


    // Minimal 2 baris jurnal
    addJournalRow();
    addJournalRow();


    // Form submit
    document
        .getElementById("voucher-form")
        .addEventListener("submit", handleFormSubmit);

});


// =========================================================
// SAVE SUPABASE CONFIG
// =========================================================

function saveSupabaseConfig() {

    const url =
        document
            .getElementById("input-supabase-url")
            .value
            .trim();

    const key =
        document
            .getElementById("input-supabase-key")
            .value
            .trim();


    if (!url || !key) {

        showNotification(
            "URL dan Anon/Publishable Key Supabase wajib diisi.",
            "error"
        );

        return;
    }


    // Simpan konfigurasi
    localStorage.setItem(
        "sia_supabase_url",
        url
    );

    localStorage.setItem(
        "sia_supabase_key",
        key
    );


    initSupabase(url, key);
}


// =========================================================
// INITIALIZE SUPABASE
// =========================================================

async function initSupabase(url, key) {

    try {

        updateConnectionStatus(
            "loading",
            "Menghubungkan ke Supabase..."
        );


        supabaseClient =
            window.supabase.createClient(
                url,
                key
            );


        // Ambil Chart of Accounts
        await fetchChartOfAccounts();


    } catch (error) {

        console.error(
            "Supabase Connection Error:",
            error
        );


        updateConnectionStatus(
            "error",
            "Gagal Terhubung"
        );


        showNotification(
            "Gagal menghubungkan ke Supabase: " +
            error.message,
            "error"
        );
    }
}


// =========================================================
// FETCH CHART OF ACCOUNTS
// =========================================================

async function fetchChartOfAccounts() {

    if (!supabaseClient) {
        return;
    }


    try {

        const { data, error } =
            await supabaseClient

                .from("chart_of_accounts")

                .select(`
                    account_id,
                    account_code,
                    account_name,
                    normal_balance,
                    report_classification
                `)

                .order(
                    "account_code",
                    { ascending: true }
                );


        if (error) {
            throw error;
        }


        if (!data || data.length === 0) {

            throw new Error(
                "Tabel chart_of_accounts kosong."
            );
        }


        chartOfAccounts = data;


        updateConnectionStatus(
            "connected",
            "Terhubung ke PostgreSQL"
        );


        showNotification(
            "Chart of Accounts berhasil dimuat.",
            "success"
        );


        // Update dropdown akun
        refreshAllAccountDropdowns();

        validateForm();


    } catch (error) {

        console.error(
            "COA Error:",
            error
        );


        updateConnectionStatus(
            "error",
            "Gagal Memuat COA"
        );


        showNotification(
            "Gagal mengambil Chart of Accounts: " +
            error.message,
            "error"
        );
    }
}


// =========================================================
// CONNECTION STATUS
// =========================================================

function updateConnectionStatus(status, text) {

    const badge =
        document.getElementById(
            "connection-status"
        );


    badge.className =
        "connection-status";


    if (status === "connected") {

        badge.classList.add(
            "status-connected"
        );

        document
            .getElementById("config-card")
            .classList
            .add("hidden");

    }

    else if (status === "loading") {

        badge.classList.add(
            "status-loading"
        );

    }

    else {

        badge.classList.add(
            "status-error"
        );

        document
            .getElementById("config-card")
            .classList
            .remove("hidden");
    }


    badge.innerHTML =
        `<span class="status-dot"></span>${text}`;
}


// =========================================================
// ADD JOURNAL ROW
// =========================================================

function addJournalRow() {

    const container =
        document.getElementById(
            "journal-lines-container"
        );


    const rowId =
        "row_" +
        Math.random()
            .toString(36)
            .substring(2, 11);


    const row =
        document.createElement("tr");


    row.id = rowId;


    row.innerHTML = `

        <td>

            <select
                class="account-select"
                onchange="validateForm()"
            >

                <option value="">
                    -- Pilih Akun --
                </option>

                ${createAccountOptions()}

            </select>

        </td>


        <td>

            <input
                type="number"
                min="0"
                step="0.01"
                value="0"
                class="debit-input"
                oninput="handleDebitInput('${rowId}')"
            >

        </td>


        <td>

            <input
                type="number"
                min="0"
                step="0.01"
                value="0"
                class="kredit-input"
                oninput="handleCreditInput('${rowId}')"
            >

        </td>


        <td style="text-align:center;">

            <button
                type="button"
                class="btn btn-delete"
                onclick="removeJournalRow('${rowId}')"
                title="Hapus baris"
            >
                ×
            </button>

        </td>

    `;


    container.appendChild(row);


    calculateTotals();
    validateForm();
}


// =========================================================
// CREATE ACCOUNT OPTIONS
// =========================================================

function createAccountOptions() {

    return chartOfAccounts

        .map(account => {

            return `
                <option value="${account.account_id}">
                    ${account.account_code}
                    -
                    ${account.account_name}
                </option>
            `;

        })

        .join("");
}


// =========================================================
// REFRESH ACCOUNT DROPDOWN
// =========================================================

function refreshAllAccountDropdowns() {

    const selects =
        document.querySelectorAll(
            ".account-select"
        );


    selects.forEach(select => {

        const currentValue =
            select.value;


        select.innerHTML = `

            <option value="">
                -- Pilih Akun --
            </option>

            ${createAccountOptions()}

        `;


        if (currentValue) {
            select.value = currentValue;
        }

    });
}


// =========================================================
// REMOVE JOURNAL ROW
// =========================================================

function removeJournalRow(rowId) {

    const container =
        document.getElementById(
            "journal-lines-container"
        );


    if (container.rows.length <= 2) {

        showNotification(
            "Minimal harus terdapat 2 baris jurnal.",
            "error"
        );

        return;
    }


    const row =
        document.getElementById(rowId);


    if (row) {
        row.remove();
    }


    calculateTotals();
    validateForm();
}


// =========================================================
// DEBIT INPUT
// =========================================================

function handleDebitInput(rowId) {

    const row =
        document.getElementById(rowId);


    const debitInput =
        row.querySelector(
            ".debit-input"
        );


    const creditInput =
        row.querySelector(
            ".kredit-input"
        );


    const debit =
        parseFloat(
            debitInput.value
        ) || 0;


    // Jika debit > 0,
    // kredit otomatis menjadi 0
    if (debit > 0) {

        creditInput.value = 0;
    }


    calculateTotals();
    validateForm();
}


// =========================================================
// CREDIT INPUT
// =========================================================

function handleCreditInput(rowId) {

    const row =
        document.getElementById(rowId);


    const debitInput =
        row.querySelector(
            ".debit-input"
        );


    const creditInput =
        row.querySelector(
            ".kredit-input"
        );


    const credit =
        parseFloat(
            creditInput.value
        ) || 0;


    // Jika kredit > 0,
    // debit otomatis menjadi 0
    if (credit > 0) {

        debitInput.value = 0;
    }


    calculateTotals();
    validateForm();
}


// =========================================================
// CALCULATE TOTALS
// =========================================================

function calculateTotals() {

    const rows =
        document.querySelectorAll(
            "#journal-lines-container tr"
        );


    let totalDebitInt = 0;
    let totalCreditInt = 0;


    rows.forEach(row => {

        const debit =
            parseFloat(
                row.querySelector(
                    ".debit-input"
                ).value
            ) || 0;


        const credit =
            parseFloat(
                row.querySelector(
                    ".kredit-input"
                ).value
            ) || 0;


        totalDebitInt +=
            Math.round(
                debit * INT_MULTIPLIER
            );


        totalCreditInt +=
            Math.round(
                credit * INT_MULTIPLIER
            );
    });


    const totalDebit =
        totalDebitInt /
        INT_MULTIPLIER;


    const totalCredit =
        totalCreditInt /
        INT_MULTIPLIER;


    const difference =
        Math.abs(
            totalDebitInt -
            totalCreditInt
        ) /
        INT_MULTIPLIER;


    // Tampilkan total
    document.getElementById(
        "display-total-debit"
    ).textContent =
        formatRupiah(totalDebit);


    document.getElementById(
        "display-total-kredit"
    ).textContent =
        formatRupiah(totalCredit);


    document.getElementById(
        "display-selisih"
    ).textContent =
        formatRupiah(difference);


    // Cek balance
    const isBalanced =
        totalDebitInt === totalCreditInt &&
        totalDebitInt > 0;


    const indicator =
        document.getElementById(
            "balance-indicator"
        );


    if (isBalanced) {

        indicator.className =
            "balance-indicator balanced";

        indicator.textContent =
            "BALANCE";

    } else {

        indicator.className =
            "balance-indicator not-balanced";

        indicator.textContent =
            "TIDAK BALANCE";
    }


    return {

        totalDebitInt,
        totalCreditInt,
        totalDebit,
        totalCredit,
        isBalanced

    };
}


// =========================================================
// VALIDATE FORM
// =========================================================

function validateForm() {

    const trxDate =
        document
            .getElementById("trx_date")
            .value;


    const refNo =
        document
            .getElementById("ref_no")
            .value
            .trim();


    const description =
        document
            .getElementById("description")
            .value
            .trim();


    const rows =
        document.querySelectorAll(
            "#journal-lines-container tr"
        );


    let isValid = true;

    let totalDebitInt = 0;
    let totalCreditInt = 0;


    // Header wajib diisi
    if (
        !trxDate ||
        !refNo ||
        !description
    ) {

        isValid = false;
    }


    // Minimal 2 baris
    if (rows.length < 2) {

        isValid = false;
    }


    rows.forEach(row => {

        const accountId =
            row.querySelector(
                ".account-select"
            ).value;


        const debit =
            parseFloat(
                row.querySelector(
                    ".debit-input"
                ).value
            ) || 0;


        const credit =
            parseFloat(
                row.querySelector(
                    ".kredit-input"
                ).value
            ) || 0;


        // Akun wajib dipilih
        if (!accountId) {

            isValid = false;
        }


        // Tidak boleh negatif
        if (
            debit < 0 ||
            credit < 0
        ) {

            isValid = false;
        }


        // Tidak boleh debit dan kredit sekaligus
        if (
            debit > 0 &&
            credit > 0
        ) {

            isValid = false;
        }


        // Salah satu harus > 0
        if (
            debit === 0 &&
            credit === 0
        ) {

            isValid = false;
        }


        totalDebitInt +=
            Math.round(
                debit *
                INT_MULTIPLIER
            );


        totalCreditInt +=
            Math.round(
                credit *
                INT_MULTIPLIER
            );

    });


    // Double-entry harus balance
    if (
        totalDebitInt !==
        totalCreditInt
    ) {

        isValid = false;
    }


    // Total tidak boleh nol
    if (
        totalDebitInt <= 0 ||
        totalCreditInt <= 0
    ) {

        isValid = false;
    }


    // Harus sudah terkoneksi
    if (!supabaseClient) {

        isValid = false;
    }


    document.getElementById(
        "btn-submit"
    ).disabled = !isValid;


    calculateTotals();


    return isValid;
}


// =========================================================
// LIVE HEADER VALIDATION
// =========================================================

document.addEventListener(
    "input",
    function (event) {

        if (
            event.target.id === "trx_date" ||
            event.target.id === "ref_no" ||
            event.target.id === "description"
        ) {

            validateForm();
        }

    }
);


// =========================================================
// FORM SUBMISSION
// =========================================================

async function handleFormSubmit(event) {

    event.preventDefault();


    if (!supabaseClient) {

        showNotification(
            "Supabase belum terhubung.",
            "error"
        );

        return;
    }


    if (!validateForm()) {

        showNotification(
            "Data jurnal belum valid atau belum balance.",
            "error"
        );

        return;
    }


    const trxDate =
        document
            .getElementById("trx_date")
            .value;


    const refNo =
        document
            .getElementById("ref_no")
            .value
            .trim();


    const description =
        document
            .getElementById("description")
            .value
            .trim();


    const rows =
        document.querySelectorAll(
            "#journal-lines-container tr"
        );


    // =====================================================
    // MEMBUAT p_lines SESUAI RPC POSTGRESQL
    // =====================================================

    const pLines = [];


    rows.forEach(row => {

        const accountId =
            parseInt(
                row.querySelector(
                    ".account-select"
                ).value
            );


        const debit =
            parseFloat(
                row.querySelector(
                    ".debit-input"
                ).value
            ) || 0;


        const credit =
            parseFloat(
                row.querySelector(
                    ".kredit-input"
                ).value
            ) || 0;


        pLines.push({

            account_id: accountId,

            debit: debit,

            credit: credit

        });

    });


    const submitButton =
        document.getElementById(
            "btn-submit"
        );


    submitButton.disabled = true;

    submitButton.textContent =
        "Memproses & Memposting...";


    try {

        // =================================================
        // MEMANGGIL RPC SUPABASE
        // =================================================

        const { data, error } =
            await supabaseClient.rpc(
                "rpc_create_posted_journal",
                {

                    p_trx_date:
                        trxDate,

                    p_ref_no:
                        refNo,

                    p_description:
                        description,

                    p_lines:
                        pLines

                }
            );


        if (error) {
            throw error;
        }


        // =================================================
        // BERHASIL
        // =================================================

        showNotification(

            `Voucher berhasil disimpan dan diposting.
            ID Jurnal: ${data}`,

            "success"
        );


        resetVoucherForm();


    } catch (error) {

        console.error(
            "RPC Error:",
            error
        );


        showNotification(
            "Gagal memproses transaksi: " +
            error.message,
            "error"
        );

    } finally {

        submitButton.textContent =
            "Simpan & Posting";


        validateForm();
    }
}


// =========================================================
// RESET FORM
// =========================================================

function resetVoucherForm() {

    document
        .getElementById(
            "voucher-form"
        )
        .reset();


    // Tanggal kembali hari ini
    document.getElementById(
        "trx_date"
    ).value =
        new Date()
            .toISOString()
            .split("T")[0];


    // Hapus semua baris jurnal
    document.getElementById(
        "journal-lines-container"
    ).innerHTML = "";


    // Kembalikan menjadi minimal 2 baris
    addJournalRow();
    addJournalRow();


    calculateTotals();
    validateForm();
}


// =========================================================
// FORMAT RUPIAH
// =========================================================

function formatRupiah(amount) {

    return new Intl.NumberFormat(
        "id-ID",
        {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }
    ).format(amount);
}


// =========================================================
// NOTIFICATION
// =========================================================

function showNotification(
    message,
    type
) {

    const notification =
        document.getElementById(
            "notification"
        );


    notification.className =
        "notification";


    if (type === "success") {

        notification.classList.add(
            "notification-success"
        );

    } else {

        notification.classList.add(
            "notification-error"
        );
    }


    notification.textContent =
        message;


    // Scroll ke atas agar notifikasi terlihat
    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}