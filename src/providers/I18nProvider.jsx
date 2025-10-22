// src/providers/I18nProvider.jsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";

const I18nCtx = createContext({
  locale: "en",
  dir: "ltr",
  t: (k) => k,
  setLocale: () => {},
});

/* ========================================================================== */
/* Strings                                                                    */
/* ========================================================================== */
export const STRINGS = {
  /* =============================== ENGLISH ================================= */
  en: {
    close: "Close",
    homeAria: "Bineytna Home",
    version: "v",
    lang: "Language",
    ar: "Arabic",
    en: "English",
    cancel: "Cancel",
    confirm: "Confirm",
    save: "Save",
    saving: "Saving…",
    loading: "Loading…",

    common: {
      name: "Name",
      address: "Address",
      city: "City",
      country: "Country",
    },

    buildings: {
      title: "Buildings",
      manage: "Manage",
      add: "Add building",
      units: "units",
      activeUnits: "active",
      mgrId: "Mgr ID",
      loadingBlocks: "Loading blocks…",
      status: {
        active: "ACTIVE",
        inactive: "INACTIVE",
        all: "All statuses",
        activeOnly: "Active",
        inactiveOnly: "Inactive",
      },
      toolbar: {
        search: "Search name, address, city…",
        refresh: "Refresh",
        refreshing: "Refreshing…",
      },
      actions: {
        edit: "Edit",
        delete: "Delete",
        activate: "Activate",
        deactivate: "Deactivate",
        reassign: "Reassign",
      },
      editor: {
        editTitle: "Edit building",
        addTitle: "Add building",
        blocks: "Blocks",
        tipUnique: "Tip: Block names must be unique (A, B, C…).",
        blockName: "Block name",
        nameUnique: "Name must be unique.",
        floors: "Floors (optional)",
        addUnitsPrefix: "Add units (start from {{n}})",
        removeBlock: "Remove block",
        addBlock: "+ Add block",
        blocksOptional:
          "Blocks are optional; you can add or rename them at any time.",
        quick: "Quick generate blocks and units",
        howManyBlocks: "How many blocks?",
        unitsInBlock: "Units in block {{b}}",
        floorsInBlock: "Floors in block {{b}} (optional)",
        patternTip: "Units will be generated like A-01, A-02…; B-01…",
      },
      notices: {
        someBlocks: "Some blocks weren’t deleted",
        pleaseFix:
          "Please delete or reassign its units in the Units tab, then try again.",
      },
      confirm: {
        deleteTitle: "Delete building?",
        deleteMsg: "“{{name}}” and its data will be permanently removed.",
        delete: "Delete",
        removeTitle: "Remove block?",
        removeMsg:
          "This only removes the block row from the editor. The actual deletion happens after you Save.",
        remove: "Remove",
      },
      creating: "Creating {{count}} unit(s)…",
      empty: "No buildings found. {{hint}}",
      emptyHint: "Add one to get started.",
      reassigned1: "Manager reassigned.",
      reassignedN: "{{n}} buildings reassigned.",
      block: "Block",
      aBlock: "A block",
    },

    units: {
      title: "Units",
      manage: "Manage",
      empty: "No units found.",
      toolbar: {
        search:
          "Search unit code, floor, size, bedrooms… (also matches building & block)",
      },
      status: {
        available: "AVAILABLE",
        occupied: "OCCUPIED",
        inactive: "INACTIVE",
        all: "All statuses",
        availableOnly: "Available",
        occupiedOnly: "Occupied",
        inactiveOnly: "Inactive",
      },
      edit: {
        title: "Edit unit",
      },
      filters: {
        allBuildings: "All buildings",
        allBlocks: "All blocks",
        pickBuildingFirst: "Pick a building first",
      },
      fields: {
        building: "Building",
        block: "Block",
        unitCode: "Unit code",
        floor: "Floor",
        bedrooms: "Bedrooms",
        bathrooms: "Bathrooms",
        sqm: "Area (m²)",
        m2: "m²",
        status: "Status",
        bedroomsShort: "BR",
        bathroomsShort: "BA",
      },
      add: {
        title: "Add unit",
        selectBuilding: "Select a building",
        orTypeNewBlock: "…or type a new block name",
        codePlaceholder: "e.g. A-101",
        unit: "Unit",
        required: "Building and Unit code are required.",
      },
      actions: {
        add: "Add unit",
        delete: "Delete",
        deleteSelected: "Delete selected",
        deleteSelectedN: "Delete selected ({{n}})",
        confirmBulk: "Delete {{n}} selected unit(s)?",
        selectAll: "Select all",
        selectUnit: "Select unit",
        selectedN: "{{n}} selected",
        totalUnitsN: "{{n}} units",
      },
      confirm: {
        deleteTitle: "Delete unit?",
        deleteMsg: "“{{code}}” will be permanently removed.",
        delete: "Delete",
      },
    },

    issues: {
      title: "Issues",
      manage: "Manage",
      issue: "Issue",
      unit: "Unit",
      add: "Add issue",
      empty: "No issues found.",
      toolbar: {
        search: "Search title, unit, building…",
        refresh: "Refresh",
        refreshing: "Refreshing…",
        allBuildings: "All buildings",
        allStatuses: "All statuses",
        allPriorities: "All priorities",
        allCategories: "All categories",
        total: "Total {{n}}",
      },
      status: {
        OPEN: "Open",
        IN_PROGRESS: "In progress",
        ON_HOLD: "On hold",
        RESOLVED: "Resolved",
        CLOSED: "Closed",
      },
      priority: {
        LOW: "Low",
        MEDIUM: "Medium",
        HIGH: "High",
        URGENT: "Urgent",
      },
      category: {
        PLUMBING: "Plumbing",
        ELECTRICAL: "Electrical",
        LIFT: "Lift",
        SECURITY: "Security",
        NOISE: "Noise",
        CLEANING: "Cleaning",
        OTHER: "Other",
      },
      editor: {
        addTitle: "Add issue",
        editTitle: "Edit issue",
        selectBuilding: "Select building…",
        selectUnit: "Select unit…",
        titlePH: "Title",
        descPH: "Describe the issue…",
        categoryLabel: "Category",
        priorityLabel: "Priority",
        titleLabel: "Title",
        descLabel: "Description",
      },
      actions: { edit: "Edit", delete: "Delete" },
      confirm: {
        deleteTitle: "Delete issue?",
        deleteMsg: "“{{title}}” will be permanently removed.",
        delete: "Delete",
      },
      validation: {
        chooseBuilding: "Please choose a building.",
        chooseUnit: "Please choose a unit.",
        enterTitle: "Please enter a title.",
      },
      filters: {
        title: "Filters",
        refine: "Refine the issues list",
        clearAll: "Clear all",
        apply: "Apply filters",
      },
    },

    payments: {
      title: "Payments",
      charge: "Charge",
      empty: "No payments or charges found.",
      header: { finance: "Finance" },
      toolbar: {
        search: "Search ref, unit, resident…",
        allBuildings: "All buildings",
        allStatuses: "All statuses",
      },
      summaries: {
        pending: "Pending",
        overdue: "Overdue",
        visible: "Visible items",
      },
      status: {
        PENDING: "Pending",
        PAID: "Paid",
        OVERDUE: "Overdue",
        CANCELLED: "Cancelled",
      },
      methods: {
        CASH: "Cash",
        CARD: "Card",
        BANK_TRANSFER: "Bank transfer",
        ONLINE: "Online",
      },
      labels: {
        unit: "Unit",
        units: "units",
        due: "Due",
        amount: "Amount",
        location: "Location",
        refWith: "Ref {{ref}}",
        statusTitle: "Status",
      },
      actions: {
        addCharge: "Add charge",
        recordPayment: "Record payment",
        recordShort: "Record",
        edit: "Edit",
        cancel: "Cancel",
        invoice: "Invoice",
        savePayment: "Save payment",
        cancelNow: "Cancel now",
        cancelling: "Cancelling…",
        viewUnits: "View units",
        hide: "Hide",
      },
      editor: {
        addTitle: "Add charge",
        editTitle: "Edit charge",
        selectBuilding: "Select building…",
        selectUnit: "Select unit…",
        selectBlock: "Select block…",
        excludeUnits: "Exclude units in this block (optional)",
        pickBlockFirst: "Pick a block first.",
        noUnitsInBlock: "No units in this block.",
        titlePH: "Title (e.g., Rent Sep)",
        amountPH: "Amount",
        amountTotalPH: "Total amount (will split equally)",
        currencyPH: "Currency",
        notesPH: "Notes (optional)",
        invoiceRequired: "Invoice photo (required for new charges)",
        viewCurrentInvoice: "View current invoice image",
        fileTypeErr: "Please upload an image or PDF.",
        fileTooLargeErr: "File is too large (max 8MB).",
        apply: {
          single: "Apply to single unit",
          split: "Split equally across units",
        },
      },
      paymentEditor: {
        title: "Record payment for {{title}}",
        amount: "Amount",
        method: "Method",
        referencePH: "Reference (receipt, txn id)",
      },
      confirm: {
        cancelCharge: "Cancel charge “{{title}}”?",
        cancelChargeTitle: "Cancel charge?",
        cancelChargeMsg: "Cancel charge “{{title}}”?",
      },
      validation: {
        selectBuilding: "Please select a building.",
        enterTitle: "Enter a title.",
        enterAmount: "Enter a valid amount.",
        attachInvoice: "Please attach an invoice image.",
        selectBlock: "Please select a block.",
        selectUnit: "Please select a unit.",
      },
      bulk: {
        cta: "Record {{n}}",
        title: "Record payments in bulk",
        count: "{{n}} selected charges will be marked Paid (full amount).",
        save: "Record all",
        progress: "Processing…",
        errors: "Errors",
        someFailed: "Some payments failed",
        selectGroup: "Select group",
        selectCharge: "Select charge",
      },
    },
    // Add under STRINGS.en = { ... }
    cash: {
      title: "Cash Drawer",
      header: { finance: "Finance" },

      aria: { selectBuilding: "Select building" },

      labels: {
        buildingWith: "Building: {{id}}",
      },

      filters: {
        title: "Filters",
        help: "Narrow the ledger by date & page size",
        open: "Open filters",
        from: "From",
        to: "To",
        pageSize: "Page Size",
        thisMonth: "This month",
        last7: "Last 7 days",
        allTime: "All time",
        apply: "Apply filters",
        clear: "Clear",
        fromWith: "From: {{d}}",
        toWith: "To: {{d}}",
        pageWith: "Page: {{n}}",
      },

      summaries: {
        current: "Current Balance",
        pageBalance: "Page Balance",
        rows: "Rows",
      },

      actions: {
        amount: "Amount",
        entryDate: "Entry Date",
        noteOpt: "Note (optional)",
        category: "Category",

        collecting: "Collecting…",
        adjusting: "Adjusting…",
        spending: "Spending…",
        adjust: {
          title: "Adjust Balance (±)",
          amountLabel: "Amount (use + or -)",
          amountHint: "Positive to increase, negative to reduce",
          cta: "Adjust",
          busy: "Adjusting…",
        },
        collect: {
          title: "Collect Cash (Manual In)",
          cta: "Collect",
          busy: "Collecting…",
        },
        spend: {
          title: "Spend Cash (Out)",
          cta: "Spend",
          busy: "Spending…",
        },
      },

      ledger: {
        title: "Ledger",
        refine: "Refine",
        apply: "Apply",
        date: "Date",
        type: "Type",
        category: "Category",
        note: "Note",
        amount: "Amount",
        balanceAfter: "Balance After",
        balanceShort: "Bal: {{v}}",
        empty: "No entries found.",
        loadMore: "Load more",
        export: "Export CSV",
        exporting: "Exporting…",
      },

      entryType: {
        TENANT_CASH_IN: "Tenant cash in",
        MGMT_CASH_OUT: "Management cash out",
        ADJUSTMENT: "Adjustment",
      },

      errors: {
        loadFailed: "Failed to load ledger",
        actionFailed: "Action failed",
      },
    },

    ratings: {
      title: "Ratings",
      header: { feedback: "Feedback" },
      empty: "No ratings yet.",
      by: "by",
      anonymous: "Anonymous",
      toolbar: {
        search: "Search comment, rater…",
        allBuildings: "All buildings",
        allCriteria: "All criteria",
      },
      actions: { addRating: "Add rating", edit: "Edit", delete: "Delete" },
      editor: {
        addTitle: "Add rating",
        editTitle: "Edit rating",
        selectBuilding: "Select building…",
        commentPH: "Comment (optional)",
      },
      criteria: {
        Management: "Management",
        Maintenance: "Maintenance",
        Cleanliness: "Cleanliness",
        Security: "Security",
        Amenities: "Amenities",
      },
      reviews: { one: "1 review", many: "{{count}} reviews" },
      nStars: "{{n}} star(s)",
      confirm: { delete: "Delete this rating?" },
      validation: {
        selectBuilding: "Select a building.",
        selectCriterion: "Choose a criterion.",
        pickScore: "Pick a score 1–5.",
      },
    },

    profile: {
      title: "Profile",
      header: { account: "Account" },
      actions: { saveChanges: "Save changes" },
      saved: "Saved.",
      fields: {
        fullName: "Full name",
        phone: "Phone",
        username: "Username",
        email: "Email",
        status: "Status",
        approval: "Approval",
        building: "Building",
        unit: "Unit",
        lastLogin: "Last login",
        createdAt: "Created at",
        yourNamePH: "Your name",
        phonePH: "+961 ...",
      },
      approvalStates: { approved: "Approved", pending: "Pending" },
    },

    settings: {
      title: "Settings",
      areaAdmin: "Admin",
      noAccess: "You don’t have permission to view this page.",

      language: {
        title: "Language",
        help: "Choose your interface language.",
        direction: "Text direction",
        ltr: "Left-to-right",
        rtl: "Right-to-left",
      },

      invite: {
        title: "Invite user",

        labels: {
          role: "Role",
          email: "Email",
          username: "Username",
          expiresDays: "Expires in (days)",
          building: "Building",
          unit: "Unit",
        },

        hints: {
          emailOptional: "Optional — used for notifications only.",
          usernameUnique: "Must be unique. This becomes their login handle.",
          usernameDisplayOnly: "Shown to the user on sign-in and in messages.",
          expiresHelp: "How long the invite link will remain valid.",
          bindingNote:
            "Next sign-in using this link binds to this user record.",
          emailOptionalWithDomain:
            "Optional. We’ll append your company domain automatically.",
        },

        emailLocalPH: "local-part (e.g. tenant001)",
        emailPH: "email (optional)",
        usernamePH: "username (unique)",
        expiresPH: "Expires in days",
        selectBuilding: "— select building —",
        selectUnit: "— select unit —",

        errors: {
          emailLocalInvalid: "Use letters, numbers, and ._%+- only.",
          usernameRequired: "Username required",
          notAllowed: "You are not allowed to invite this role",
          selectBuilding: "Select a building",
          selectUnit: "Select a unit",
          emailRequired: "Email is required",
        },

        create: "Create invite",
        creating: "Creating…",
        copyLink: "Copy link",
        revoke: "Revoke",
        expires: "Expires",

        copiedAlert: "Invite link copied:\n{{link}}",
        createdCopied: "Invite created. Link copied:\n{{link}}",
        revokeConfirm: "Revoke invite {{code}}?",
        tip: "Tip: paste the copied link into WhatsApp. The invite binds the next sign-in to that user record (email match not required).",

        checkingEmail: "Checking…",
        emailAvailable: "Email not found — looks good.",
        emailNewOk: "Email not found — looks good.",
        emailTakenChooseAnother: "Email already in use — choose another.",
        emailTakenAttach:
          "Existing user — this invite will attach the unit to their account.",
        invalidEmailLocal: "Use letters, numbers, and ._%+- only.",
        emailCheckFailed: "Couldn’t verify email right now.",
        noEligibleUnits: "No available units for this role right now.",
        unitAlreadyAssigned:
          "This unit already has an active user for this role.",
      },

      approvals: {
        title: "Pending approvals",
        refresh: "Refresh",
        approve: "Approve",
        invited: "Invited",
        registered: "Registered",
        empty: "No users waiting for approval.",
      },

      system: {
        title: "System info",
        frontend: "Frontend version:",
        apiBase: "API base:",
      },

      copyManually: "Copy this link:",
    },
  },

  /* =============================== ARABIC ================================== */
  ar: {
    close: "إغلاق",
    homeAria: "الصفحة الرئيسية لبينيتنا",
    version: "الإصدار ",
    lang: "اللغة",
    ar: "العربية",
    en: "الإنجليزية",
    cancel: "إلغاء",
    confirm: "تأكيد",
    save: "حفظ",
    saving: "جارٍ الحفظ…",
    loading: "جارٍ التحميل…",

    common: {
      name: "الاسم",
      address: "العنوان",
      city: "المدينة",
      country: "البلد",
    },

    buildings: {
      title: "المباني",
      manage: "إدارة",
      add: "إضافة مبنى",
      units: "وحدة",
      activeUnits: "نشطة",
      mgrId: "معرّف المدير",
      loadingBlocks: "جارٍ تحميل الكتل…",
      status: {
        active: "نشط",
        inactive: "غير نشط",
        all: "كل الحالات",
        activeOnly: "نشط",
        inactiveOnly: "غير نشط",
      },
      toolbar: {
        search: "ابحث بالاسم أو العنوان أو المدينة…",
        refresh: "تحديث",
        refreshing: "جارٍ التحديث…",
      },
      actions: {
        edit: "تعديل",
        delete: "حذف",
        activate: "تفعيل",
        deactivate: "إلغاء التفعيل",
        reassign: "إعادة الإسناد",
      },
      editor: {
        editTitle: "تعديل مبنى",
        addTitle: "إضافة مبنى",
        blocks: "الكتل",
        tipUnique: "معلومة: يجب أن تكون أسماء الكتل فريدة (A, B, C…).",
        blockName: "اسم الكتلة",
        nameUnique: "الاسم يجب أن يكون فريدًا.",
        floors: "الطوابق (اختياري)",
        addUnitsPrefix: "إضافة وحدات (بدءاً من {{n}})",
        removeBlock: "إزالة الكتلة",
        addBlock: "+ إضافة كتلة",
        blocksOptional:
          "الكتل اختيارية؛ يمكنك إضافتها أو إعادة تسميتها لاحقًا.",
        quick: "توليد سريع للكتل والوحدات",
        howManyBlocks: "كم عدد الكتل؟",
        unitsInBlock: "عدد الوحدات في الكتلة {{b}}",
        floorsInBlock: "عدد الطوابق في الكتلة {{b}} (اختياري)",
        patternTip: "ستُنشأ الوحدات بالشكل A-01, A-02…؛ B-01…",
      },
      notices: {
        someBlocks: "تعذّر حذف بعض الكتل",
        pleaseFix:
          "يرجى حذف وحداتها أو إعادة إسنادها من تبويب الوحدات ثم المحاولة مجددًا.",
      },
      confirm: {
        deleteTitle: "حذف المبنى؟",
        deleteMsg: "“{{name}}” وجميع بياناته ستحذف نهائيًا.",
        delete: "حذف",
        removeTitle: "إزالة الكتلة؟",
        removeMsg:
          "سيتم حذف صف الكتلة من المحرر فقط. يحدث الحذف الفعلي بعد الحفظ.",
        remove: "إزالة",
      },
      creating: "جارٍ إنشاء {{count}} وحدة…",
      empty: "لا توجد مبانٍ. {{hint}}",
      emptyHint: "أضف مبنى للبدء.",
      reassigned1: "تمت إعادة إسناد المدير.",
      reassignedN: "تمت إعادة إسناد {{n}} مبانٍ.",
      block: "الكتلة",
      aBlock: "كتلة",
    },

    units: {
      title: "الوحدات",
      manage: "إدارة",
      empty: "لا توجد وحدات.",
      toolbar: {
        search:
          "ابحث برمز الوحدة أو الطابق أو المساحة أو الغرف… (يشمل المبنى والكتلة)",
      },
      status: {
        available: "متاحة",
        occupied: "مشغولة",
        inactive: "غير مفعّلة",
        all: "كل الحالات",
        availableOnly: "متاحة",
        occupiedOnly: "مشغولة",
        inactiveOnly: "غير مفعّلة",
      },
      filters: {
        allBuildings: "كل المباني",
        allBlocks: "كل الكتل",
        pickBuildingFirst: "اختر مبنى أولاً",
      },
      fields: {
        building: "المبنى",
        block: "الكتلة",
        unitCode: "رمز الوحدة",
        floor: "الطابق",
        bedrooms: "غرف النوم",
        bathrooms: "الحمّامات",
        sqm: "المساحة (م²)",
        m2: "م²",
        status: "الحالة",
        bedroomsShort: "غرف",
        bathroomsShort: "حمّامات",
      },
      add: {
        title: "إضافة وحدة",
        selectBuilding: "اختر مبنى",
        orTypeNewBlock: "…أو اكتب اسم كتلة جديد",
        codePlaceholder: "مثال: A-101",
        unit: "وحدة",
        required: "المبنى ورمز الوحدة حقول مطلوبة.",
      },
      actions: {
        add: "إضافة وحدة",
        delete: "حذف",
        deleteSelected: "حذف المحدد",
        deleteSelectedN: "حذف المحدد ({{n}})",
        confirmBulk: "هل تريد حذف {{n}} وحدة محددة؟",
        selectAll: "تحديد الكل",
        selectUnit: "تحديد وحدة",
        selectedN: "{{n}} محددة",
        totalUnitsN: "{{n}} وحدة",
      },
      confirm: {
        deleteTitle: "حذف الوحدة؟",
        deleteMsg: "“{{code}}” ستحذف نهائياً.",
        delete: "حذف",
      },
      edit: {
        title: "تعديل وحدة",
      },
    },

    issues: {
      title: "المشكلات",
      manage: "إدارة",
      issue: "مشكلة",
      unit: "الوحدة",
      add: "إضافة مشكلة",
      empty: "لا توجد مشكلات.",
      toolbar: {
        search: "ابحث بالعنوان أو الوحدة أو المبنى…",
        refresh: "تحديث",
        refreshing: "جارٍ التحديث…",
        allBuildings: "كل المباني",
        allStatuses: "كل الحالات",
        allPriorities: "كل الأولويات",
        allCategories: "كل الفئات",
        total: "المجموع {{n}}",
      },
      filters: {
        title: "عوامل التصفية",
        refine: "تصفية قائمة المشكلات",
        clearAll: "مسح الكل",
        apply: "تطبيق التصفية",
      },
      status: {
        OPEN: "مفتوحة",
        IN_PROGRESS: "قيد المعالجة",
        ON_HOLD: "معلّقة",
        RESOLVED: "محلولة",
        CLOSED: "مغلقة",
      },
      priority: {
        LOW: "منخفضة",
        MEDIUM: "متوسطة",
        HIGH: "مرتفعة",
        URGENT: "عاجلة",
      },
      category: {
        PLUMBING: "سباكة",
        ELECTRICAL: "كهرباء",
        LIFT: "مصعد",
        SECURITY: "أمن",
        NOISE: "ضوضاء",
        CLEANING: "تنظيف",
        OTHER: "أخرى",
      },
      editor: {
        addTitle: "إضافة مشكلة",
        editTitle: "تعديل مشكلة",
        selectBuilding: "اختر مبنى…",
        selectUnit: "اختر وحدة…",
        titlePH: "العنوان",
        descPH: "صف المشكلة…",
        categoryLabel: "الفئة",
        priorityLabel: "الأولوية",
        titleLabel: "العنوان",
        descLabel: "الوصف",
      },
      actions: { edit: "تعديل", delete: "حذف" },
      confirm: {
        deleteTitle: "حذف المشكلة؟",
        deleteMsg: "“{{title}}” ستحذف نهائيًا.",
        delete: "حذف",
      },
      validation: {
        chooseBuilding: "يرجى اختيار مبنى.",
        chooseUnit: "يرجى اختيار وحدة.",
        enterTitle: "يرجى إدخال عنوان.",
      },
    },

    payments: {
      title: "المدفوعات",
      charge: "رسم",
      empty: "لا توجد مدفوعات أو مطالبات.",
      header: { finance: "المالية" },
      toolbar: {
        search: "ابحث بالمرجع أو الوحدة أو المقيم…",
        allBuildings: "كل المباني",
        allStatuses: "كل الحالات",
      },
      summaries: {
        pending: "قيد الانتظار",
        overdue: "متأخرة",
        visible: "العناصر الظاهرة",
      },
      status: {
        PENDING: "قيد الانتظار",
        PAID: "مدفوعة",
        OVERDUE: "متأخرة",
        CANCELLED: "ملغاة",
      },
      methods: {
        CASH: "نقدًا",
        CARD: "بطاقة",
        BANK_TRANSFER: "تحويل بنكي",
        ONLINE: "عبر الإنترنت",
      },
      labels: {
        unit: "الوحدة",
        units: "وحدات",
        due: "مستحق",
        amount: "المبلغ",
        location: "الموقع",
        refWith: "مرجع {{ref}}",
        statusTitle: "الحالة",
      },
      actions: {
        addCharge: "إضافة رسم",
        recordPayment: "تسجيل دفعة",
        recordShort: "تسجيل",
        edit: "تعديل",
        cancel: "إلغاء",
        invoice: "فاتورة",
        savePayment: "حفظ الدفعة",
        cancelNow: "إلغاء الآن",
        cancelling: "جارٍ الإلغاء…",
        viewUnits: "عرض الوحدات",
        hide: "إخفاء",
      },
      editor: {
        addTitle: "إضافة رسم",
        editTitle: "تعديل رسم",
        selectBuilding: "اختر مبنى…",
        selectUnit: "اختر وحدة…",
        selectBlock: "اختر كتلة…",
        excludeUnits: "استثناء وحدات في هذه الكتلة (اختياري)",
        pickBlockFirst: "اختر كتلة أولاً.",
        noUnitsInBlock: "لا توجد وحدات في هذه الكتلة.",
        titlePH: "العنوان (مثال: إيجار أيلول)",
        amountPH: "المبلغ",
        amountTotalPH: "المبلغ الإجمالي (سيُقسّم بالتساوي)",
        currencyPH: "العملة",
        notesPH: "ملاحظات (اختياري)",
        invoiceRequired: "صورة الفاتورة مطلوبة للمطالبات الجديدة",
        viewCurrentInvoice: "عرض صورة الفاتورة الحالية",
        fileTypeErr: "يرجى رفع صورة أو ملف PDF.",
        fileTooLargeErr: "الملف كبير جدًا (الحد 8MB).",
        apply: {
          single: "تطبيق على وحدة واحدة",
          split: "تقسيم بالتساوي على الوحدات",
        },
      },
      paymentEditor: {
        title: "تسجيل دفعة لـ {{title}}",
        amount: "المبلغ",
        method: "طريقة الدفع",
        referencePH: "مرجع (إيصال، رقم العملية)",
      },
      confirm: {
        cancelCharge: "إلغاء الرسم “{{title}}”؟",
        cancelChargeTitle: "إلغاء الرسم؟",
        cancelChargeMsg: "هل تريد إلغاء الرسم “{{title}}”؟",
      },
      validation: {
        selectBuilding: "يرجى اختيار مبنى.",
        enterTitle: "يرجى إدخال عنوان.",
        enterAmount: "يرجى إدخال مبلغ صحيح.",
        attachInvoice: "يرجى إرفاق صورة للفاتورة.",
        selectBlock: "يرجى اختيار كتلة.",
        selectUnit: "يرجى اختيار وحدة.",
      },
      bulk: {
        cta: "تسجيل {{n}}",
        title: "تسجيل دفعات بالجملة",
        count:
          'سيتم وضع علامة "مدفوعة" على {{n}} من المطالبات المحددة (المبلغ الكامل).',
        save: "تسجيل الكل",
        progress: "جارٍ المعالجة…",
        errors: "الأخطاء",
        someFailed: "فشلت بعض الدفعات",
        selectGroup: "تحديد المجموعة",
        selectCharge: "تحديد الرسم",
      },
    },
    // Add under STRINGS.ar = { ... }
    cash: {
      title: "الصندوق النقدي",
      header: { finance: "المالية" },

      aria: { selectBuilding: "اختر مبنى" },

      labels: {
        buildingWith: "المبنى: {{id}}",
      },

      filters: {
        title: "عوامل التصفية",
        help: "تصفية السجل بالتاريخ وحجم الصفحة",
        open: "فتح عوامل التصفية",
        from: "من",
        to: "إلى",
        pageSize: "حجم الصفحة",
        thisMonth: "هذا الشهر",
        last7: "آخر 7 أيام",
        allTime: "كل الوقت",
        apply: "تطبيق التصفية",
        clear: "مسح",
        fromWith: "من: {{d}}",
        toWith: "إلى: {{d}}",
        pageWith: "الصفحة: {{n}}",
      },

      summaries: {
        current: "الرصيد الحالي",
        pageBalance: "رصيد الصفحة",
        rows: "الأسطر",
      },

      actions: {
        amount: "المبلغ",
        entryDate: "تاريخ الإدخال",
        noteOpt: "ملاحظة (اختياري)",
        category: "الفئة",

        adjust: {
          title: "تعديل الرصيد (±)",
          amountLabel: "المبلغ (استخدم + أو -)",
          amountHint: "إشارة موجبة للزيادة، سالبة للنقصان",
          cta: "تعديل",
          busy: "جارٍ التعديل…",
        },
        collect: {
          title: "تحصيل نقدي (إيداع يدوي)",
          cta: "تحصيل",
          busy: "جارٍ التحصيل…",
        },
        spend: {
          title: "صرف نقدي (خارج)",
          cta: "صرف",
          busy: "جارٍ الصرف…",
        },
        collecting: "جارٍ التحصيل…",
        adjusting: "جارٍ التعديل…",
        spending: "جارٍ الصرف…",
      },

      ledger: {
        title: "السجل",
        refine: "تصفية",
        apply: "تطبيق",
        date: "التاريخ",
        type: "النوع",
        category: "الفئة",
        note: "ملاحظة",
        amount: "المبلغ",
        balanceAfter: "الرصيد بعد العملية",
        balanceShort: "الرصيد: {{v}}",
        empty: "لا توجد قيود.",
        loadMore: "تحميل المزيد",
        export: "تصدير CSV",
       exporting: "جارٍ التصدير…",
      },

      entryType: {
        TENANT_CASH_IN: "تحصيل من المستأجر",
        MGMT_CASH_OUT: "صرف من الإدارة",
        ADJUSTMENT: "تسوية",
      },

      errors: {
        loadFailed: "فشل تحميل السجل",
        actionFailed: "فشلت العملية",
      },
    },

    ratings: {
      title: "التقييمات",
      header: { feedback: "آراء المستخدمين" },
      empty: "لا توجد تقييمات بعد.",
      by: "بواسطة",
      anonymous: "مجهول",
      toolbar: {
        search: "ابحث في التعليق أو صاحب التقييم…",
        allBuildings: "كل المباني",
        allCriteria: "كل المعايير",
      },
      actions: { addRating: "إضافة تقييم", edit: "تعديل", delete: "حذف" },
      editor: {
        addTitle: "إضافة تقييم",
        editTitle: "تعديل تقييم",
        selectBuilding: "اختر مبنى…",
        commentPH: "تعليق (اختياري)",
      },
      criteria: {
        Management: "الإدارة",
        Maintenance: "الصيانة",
        Cleanliness: "النظافة",
        Security: "الأمن",
        Amenities: "الخدمات",
      },
      reviews: { one: "تقييم واحد", many: "{{count}} تقييمات" },
      nStars: "{{n}} نجوم",
      confirm: { delete: "حذف هذا التقييم؟" },
      validation: {
        selectBuilding: "يرجى اختيار مبنى.",
        selectCriterion: "يرجى اختيار معيار.",
        pickScore: "يرجى اختيار تقييم من 1 إلى 5.",
      },
    },

    profile: {
      title: "الملف الشخصي",
      header: { account: "الحساب" },
      actions: { saveChanges: "حفظ التغييرات" },
      saved: "تم الحفظ.",
      fields: {
        fullName: "الاسم الكامل",
        phone: "الهاتف",
        username: "اسم المستخدم",
        email: "البريد الإلكتروني",
        status: "الحالة",
        approval: "الموافقة",
        building: "المبنى",
        unit: "الوحدة",
        lastLogin: "آخر تسجيل دخول",
        createdAt: "تاريخ الإنشاء",
        yourNamePH: "اسمك",
        phonePH: "+961 ...",
      },
      approvalStates: { approved: "معتمد", pending: "قيد الانتظار" },
    },

    settings: {
      title: "الإعدادات",
      areaAdmin: "المشرف",
      noAccess: "ليست لديك صلاحية لعرض هذه الصفحة.",

      language: {
        title: "اللغة",
        help: "اختر لغة واجهة المستخدم.",
        direction: "اتجاه النص",
        ltr: "من اليسار إلى اليمين",
        rtl: "من اليمين إلى اليسار",
      },

      invite: {
        title: "دعوة مستخدم",

        labels: {
          role: "الدور",
          email: "البريد الإلكتروني",
          username: "اسم المستخدم",
          expiresDays: "الصلاحية (بالأيام)",
          building: "المبنى",
          unit: "الوحدة",
        },

        hints: {
          emailOptional: "اختياري — يستخدم للإشعارات فقط.",
          usernameUnique: "يجب أن يكون فريدًا. سيصبح معرّف تسجيل الدخول.",
          usernameDisplayOnly: "يظهر للمستخدم عند تسجيل الدخول وفي الرسائل.",
          expiresHelp: "مدة صلاحية رابط الدعوة.",
          bindingNote: "أول تسجيل دخول عبر الرابط سيرتبط بهذا المستخدم.",
          emailOptionalWithDomain: "اختياري. سنضيف نطاق شركتك تلقائيًا.",
        },

        emailLocalPH: "الجزء قبل @ (مثال tenant001)",
        emailPH: "البريد الإلكتروني (اختياري)",
        usernamePH: "اسم المستخدم (فريد)",
        expiresPH: "الصلاحية بالأيام",
        selectBuilding: "— اختر مبنى —",
        selectUnit: "— اختر وحدة —",

        errors: {
          emailLocalInvalid: "استخدم حروفًا وأرقامًا والرموز ._%+- فقط.",
          usernameRequired: "اسم المستخدم مطلوب",
          notAllowed: "ليس لديك صلاحية لدعوة هذا الدور",
          selectBuilding: "اختر مبنى",
          selectUnit: "اختر وحدة",
          emailRequired: "البريد الإلكتروني مطلوب",
        },

        create: "إنشاء دعوة",
        creating: "جارٍ الإنشاء…",
        copyLink: "نسخ الرابط",
        revoke: "إلغاء",
        expires: "تنتهي في",

        copiedAlert: "تم نسخ رابط الدعوة:\n{{link}}",
        createdCopied: "تم إنشاء الدعوة. تم نسخ الرابط:\n{{link}}",
        revokeConfirm: "إلغاء دعوة {{code}}؟",
        tip: "معلومة: الصق الرابط في واتساب. ستربط الدعوة أول تسجيل دخول بهذا الحساب (لا يشترط تطابق البريد).",

        checkingEmail: "جارٍ التحقق…",
        emailAvailable: "البريد غير مستخدم — جيد.",
        emailNewOk: "البريد غير مستخدم — جيد.",
        emailTakenChooseAnother: "البريد مستخدم بالفعل — اختر آخر.",
        emailTakenAttach: "مستخدم موجود — ستربط هذه الدعوة الوحدة بحسابه.",
        invalidEmailLocal: "استخدم حروفًا وأرقامًا والرموز ._%+- فقط.",
        emailCheckFailed: "تعذّر التحقق من البريد الآن.",
        noEligibleUnits: "لا توجد وحدات متاحة لهذا الدور حاليًا.",
        unitAlreadyAssigned: "هذه الوحدة لديها مستخدم نشط لهذا الدور.",
      },

      approvals: {
        title: "طلبات الموافقة المعلّقة",
        refresh: "تحديث",
        approve: "اعتماد",
        invited: "دُعي",
        registered: "سجّل",
        empty: "لا يوجد مستخدمون بانتظار الموافقة.",
      },

      system: {
        title: "معلومات النظام",
        frontend: "إصدار الواجهة:",
        apiBase: "عنوان واجهة البرمجة:",
      },

      copyManually: "انسخ هذا الرابط:",
    },
  },
};

/* ========================================================================== */
/* Helpers                                                                    */
/* ========================================================================== */
function getDeep(obj, path) {
  return path
    .split(".")
    .reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}
function format(str, vars) {
  if (typeof str !== "string" || !vars) return str;
  return str.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) =>
    vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : `{{${k}}}`
  );
}
function detectInitialLocale(explicit) {
  if (explicit) return explicit;
  try {
    const q =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("lang")
        : null;
    if (q) return q;
  } catch {}
  try {
    const stored =
      localStorage.getItem("locale") || localStorage.getItem("i18n:locale");
    if (stored) return stored;
  } catch {}
  const navLang =
    (typeof navigator !== "undefined" && navigator.language) || "en";
  return /^ar\b/i.test(navLang) ? "ar" : "en";
}

/* ========================================================================== */
/* Provider                                                                   */
/* ========================================================================== */
export function I18nProvider({ userLocale, children }) {
  const [locale, setLocale] = useState(() => {
    const l = detectInitialLocale(userLocale);
    return l === "ar" ? "ar" : "en";
  });
  const dir = locale === "ar" ? "rtl" : "ltr";

  // Deep lookup + interpolation + English fallback
  const t = (key, vars) => {
    const val = getDeep(STRINGS[locale], key);
    const withFallback = val === undefined ? getDeep(STRINGS.en, key) : val;
    return format(withFallback ?? key, vars);
  };

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("dir", dir);
      document.documentElement.setAttribute("lang", locale);
    }
    try {
      localStorage.setItem("locale", locale);
      localStorage.setItem("i18n:locale", locale); // keep old pages in sync
    } catch {}
  }, [locale, dir]);

  const value = useMemo(() => ({ locale, dir, t, setLocale }), [locale, dir]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n() {
  return useContext(I18nCtx);
}
