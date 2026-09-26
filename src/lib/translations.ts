import {
  policyConfig,
  type PolicyPageKey,
  type PublicPolicySection,
} from "~/config/policies";
import { storeConfig } from "~/config/store";
import {
  getDeliveryAreaLabels,
  getDeliveryCurrencyLabel,
  getDeliveryMethodLabel,
  getEstimatedDeliveryDuration,
  getFreeDeliveryLabel,
  type DeliveryAreaKey,
} from "~/lib/delivery";

export type Language = "en" | "ar";

const englishStoreName = storeConfig.locales.en.name;
const arabicStoreName = storeConfig.locales.ar.name;
const englishLegal = policyConfig.locales.en;
const arabicLegal = policyConfig.locales.ar;

export type LegalPageKey = PolicyPageKey;

export type DeliveryAreaTranslationKey = DeliveryAreaKey;

export type LegalSection = PublicPolicySection;

export type TranslationDictionary = {
  brand: {
    name: string;
  };
  nav: {
    home: string;
    products: string;
    cart: string;
    orders: string;
    account: string;
    mobileNavigation: string;
  };
  actions: {
    switchToArabic: string;
    switchToEnglish: string;
    toggleLanguage: string;
    lightMode: string;
    darkMode: string;
    browseProducts: string;
    viewCart: string;
    backToProducts: string;
    clearFilters: string;
  };
  footer: {
    rights: string;
    description: string;
    contactTitle: string;
    whatsapp: string;
    phone: string;
    email: string;
    socialLinks: string;
    openSocialLink: string;
    legalLinksLabel: string;
    locationNote: string;
    onlineStoreCtaTitle: string;
    onlineStoreCtaDescription: string;
    onlineStoreCtaAction: string;
  };
  whatsappShortcut: {
    label: string;
    title: string;
    ariaLabel: string;
    defaultMessage: string;
  };
  home: {
    badge: string;
    titleStart: string;
    titleBrand: string;
    description: string;
    flowTitle: string;
    highlights: {
      title: string;
      description: string;
    }[];
    stats: {
      title: string;
      description: string;
    }[];
  };
  products: {
    badge: string;
    title: string;
    description: string;
    searchLabel: string;
    searchPlaceholder: string;
    searchButton: string;
    loadMore: string;
    loadingMore: string;
    allProducts: string;
    selectedCategory: string;
    showing: string;
    productSingular: string;
    productPlural: string;
    noProductsTitle: string;
    noProductsDescription: string;
    failedToLoad: string;
    failedToConnect: string;
    noImage: string;
    featured: string;
    soldOut: string;
    out: string;
    left: string;
    inStock: string;
    options: string;
    optionsAvailable: string;
    size: string;
    color: string;
    option: string;
    selected: string;
    selectOptionHelp: string;
    selectOptionRequired: string;
    outOfStock: string;
    descriptionTitle: string;
    noDescription: string;
    payment: string;
    cashOnDelivery: string;
    category: string;
    productId: string;
    stockNote: string;
    productNotFound: string;
    productUnavailable: string;
    image: string;
    of: string;
  };
  cart: {
    badge: string;
    title: string;
    description: string;
    itemSingular: string;
    itemPlural: string;
    cartUnavailable: string;
    tryAgain: string;
    emptyTitle: string;
    emptyDescription: string;
    orderPlacedTitle: string;
    orderPlacedDescription: string;
    orderId: string;
    total: string;
    payment: string;
    status: string;
    viewOrders: string;
    continueShopping: string;
    unavailableNotice: string;
    each: string;
    subtotal: string;
    remove: string;
    removing: string;
    noImage: string;
    productArchived: string;
    productOutOfStock: string;
    onlyLeft: string;
    orderSummary: string;
    items: string;
    paymentMethod: string;
    estimatedTotal: string;
    cashOnDelivery: string;
    placeOrder: string;
    placingOrder: string;
    orderPlacedButton: string;
    stockServerNote: string;
    failedToLoad: string;
    failedToConnect: string;
    failedToUpdate: string;
    failedToRemove: string;
    failedToPlaceOrder: string;
    failedToAddItem: string;
    itemAddedToCart: string;
    addingToCart: string;
    chooseOption: string;
    addToCart: string;
    quantityHelp: string;
    requestedQuantityUnavailable: string;
    decreaseQuantity: string;
    increaseQuantity: string;
    deliveryDetailsTitle: string;
    deliveryDetailsDescription: string;
    deliveryArea: string;
    deliveryCity: string;
    deliveryCityPlaceholder: string;
    deliveryAddress: string;
    deliveryAddressOptional: string;
    deliveryAddressPlaceholder: string;
    deliveryNotes: string;
    deliveryNotesPlaceholder: string;
    productsTotal: string;
    deliveryPrice: string;
    finalTotal: string;
    reviewOrder: string;
    confirmOrderTitle: string;
    confirmOrderDescription: string;
    contactInfo: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    savedAccountContact: string;
    cancel: string;
    confirmPlaceOrder: string;
    deliveryCityRequired: string;
    deliveryAddressRequired: string;
    pickupAgreementRequired: string;
    reviewItemsTitle: string;
    quantity: string;
    selectedOption: string;
    unitPrice: string;
    lineTotal: string;
    currency: string;
    deliveryMethod: string;
    estimatedDelivery: string;
    deliveryConditions: string;
    taxInformation: string;
    complaintsHelp: string;
    contactStore: string;
  };
  delivery: {
    currency: string;
    free: string;
    method: string;
    estimatedDuration: string;
    areas: Record<
      DeliveryAreaTranslationKey,
      {
        label: string;
        note?: string;
        agreementLabel?: string;
      }
    >;
  };
  orders: {
    badge: string;
    title: string;
    description: string;
    totalOrders: string;
    activeOrders: string;
    totalSpent: string;
    ordersUnavailable: string;
    tryAgain: string;
    noOrdersTitle: string;
    noOrdersDescription: string;
    browseProducts: string;
    refresh: string;
    loadMore: string;
    loadingMore: string;
    order: string;
    placed: string;
    total: string;
    payment: string;
    items: string;
    quantity: string;
    subtotal: string;
    noImage: string;
    deliveryDetails: string;
    deliveryArea: string;
    deliveryCity: string;
    deliveryAddress: string;
    deliveryNotes: string;
    deliveryPrice: string;
    pickupAgreement: string;
    yes: string;
    notProvided: string;
    notRequired: string;
    failedToLoad: string;
    failedToConnect: string;
    statuses: Record<string, string>;
    paymentMethods: Record<string, string>;
    paymentStatuses: Record<string, string>;
  };
  auth: {
    welcomeBackBadge: string;
    loginHeroTitle: string;
    loginHeroDescription: string;
    loginTitle: string;
    loginDescription: string;
    email: string;
    password: string;
    name: string;
    phone: string;
    phoneHelp: string;
    nameInvalid: string;
    emailInvalid: string;
    phoneInvalid: string;
    passwordRequired: string;
    passwordTooShort: string;
    fixHighlightedFields: string;
    invalidRegistrationInput: string;
    login: string;
    loggingIn: string;
    continueWithGoogle: string;
    continuingWithGoogle: string;
    orContinueWithEmail: string;
    googleSignInFailed: string;
    invalidLogin: string;
    noAccount: string;
    createOne: string;
    registerBadge: string;
    registerHeroTitle: string;
    registerHeroDescription: string;
    registerTitle: string;
    registerDescription: string;
    createAccount: string;
    creatingAccount: string;
    alreadyHaveAccount: string;
    passwordPlaceholder: string;
    passwordHelp: string;
    registerSuccess: string;
    registerVerifyEmailSuccess: string;
    failedToRegister: string;
    failedToConnect: string;
    signOut: string;
    signingOut: string;
    forgotPassword: string;
    forgotPasswordBadge: string;
    forgotPasswordHeroTitle: string;
    forgotPasswordHeroDescription: string;
    forgotPasswordTitle: string;
    forgotPasswordDescription: string;
    sendResetLink: string;
    sendingResetLink: string;
    resetRequestSuccess: string;
    resetRequestFailed: string;
    rememberPassword: string;
    backToLogin: string;
    setNewPasswordBadge: string;
    setNewPasswordHeroTitle: string;
    setNewPasswordHeroDescription: string;
    resetPasswordTitle: string;
    resetPasswordDescription: string;
    newPassword: string;
    confirmPassword: string;
    repeatPassword: string;
    resetPassword: string;
    resettingPassword: string;
    resetMissingToken: string;
    resetPasswordTooShort: string;
    passwordsDoNotMatch: string;
    resetPasswordFailed: string;
    resetPasswordSuccess: string;
    invalidResetLink: string;
    requestNewResetLink: string;
    loadingResetForm: string;
  };
  account: {
    badge: string;
    title: string;
    description: string;
    quickActions: string;
    browseProducts: string;
    browseProductsDescription: string;
    viewCart: string;
    viewCartDescription: string;
    myOrders: string;
    myOrdersDescription: string;
    adminDashboard: string;
    adminDashboardDescription: string;
    noEmail: string;
    customer: string;
    accountSetupRequired: string;
    accountSetupDescription: string;
    emailVerification: string;
    verified: string;
    notVerified: string;
    phoneNumber: string;
    added: string;
    missing: string;
    updateProfile: string;
    updateProfileDescription: string;
    sendingVerificationEmail: string;
    resendVerificationEmail: string;
    failedToSendVerificationEmail: string;
    verificationEmailSent: string;
    emailStatus: string;
    phone: string;
    notAdded: string;
  };
  profile: {
    badge: string;
    title: string;
    description: string;
    emailStatus: string;
    verified: string;
    notVerified: string;
    emailChangeHelp: string;
    name: string;
    phoneNumber: string;
    phoneHelp: string;
    nameInvalid: string;
    phoneInvalid: string;
    fixHighlightedFields: string;
    saveProfile: string;
    saving: string;
    backToAccount: string;
    failedToUpdate: string;
    updatedSuccessfully: string;
    failedToConnect: string;
  };

  legal: {
    common: {
      policyBadge: string;
      lastUpdatedLabel: string;
      lastUpdatedDate: string;
      usefulLinks: string;
      footerLinks: {
        terms: string;
        privacy: string;
        shipping: string;
        returns: string;
        contact: string;
      };
    };
    notices: {
      bySigningIn: string;
      byCreatingAccount: string;
      byPlacingOrder: string;
      privacyPolicy: string;
      termsOfUse: string;
      shippingPolicy: string;
      returnsPolicy: string;
      and: string;
    };
    pages: Record<
      LegalPageKey,
      {
        title: string;
        description: string;
        sections: readonly LegalSection[];
      }
    >;
  };

  admin: {
    dashboard: {
      badge: string;
      title: string;
      description: string;
      productsTitle: string;
      productsBadge: string;
      productsDescription: string;
      ordersTitle: string;
      ordersBadge: string;
      ordersDescription: string;
      categoriesTitle: string;
      categoriesBadge: string;
      categoriesDescription: string;
    };
    categories: {
      badge: string;
      title: string;
      description: string;
      backToDashboard: string;
      createTitle: string;
      createDescription: string;
      name: string;
      namePlaceholder: string;
      slug: string;
      slugPlaceholder: string;
      make: string;
      createButton: string;
      creating: string;
      editTitle: string;
      editDescription: string;
      saveButton: string;
      saving: string;
      cancel: string;
      listTitle: string;
      listDescription: string;
      refresh: string;
      search: string;
      searchPlaceholder: string;
      usageFilter: string;
      allUsage: string;
      withProducts: string;
      emptyCategories: string;
      sortBy: string;
      sortNameAsc: string;
      sortNameDesc: string;
      sortNewest: string;
      sortOldest: string;
      applyFilters: string;
      clearFilters: string;
      pageInfo: string;
      previousPage: string;
      nextPage: string;
      totalCategories: string;
      noCategoriesYet: string;
      productCount: string;
      deleteBlockedHint: string;
      edit: string;
      delete: string;
      deleting: string;
      deleteConfirm: string;
      cannotDeleteWithProducts: string;
      failedToLoad: string;
      failedToConnect: string;
      failedToCreate: string;
      created: string;
      failedToUpdate: string;
      updated: string;
      failedToDelete: string;
      deleted: string;
    };
    orders: {
      badge: string;
      title: string;
      description: string;
      dashboard: string;
      refresh: string;
      search: string;
      searchPlaceholder: string;
      statusFilter: string;
      allStatuses: string;
      paymentFilter: string;
      allPaymentStatuses: string;
      applyFilters: string;
      clearFilters: string;
      orderCards: string;
      pageInfo: string;
      previousPage: string;
      nextPage: string;
      currentPageOnly: string;
      totalOrders: string;
      pendingOrders: string;
      revenueExcludingCancelled: string;
      unpaidNotice: string;
      order: string;
      placed: string;
      customer: string;
      unnamedCustomer: string;
      total: string;
      orderStatus: string;
      confirmOrder: string;
      confirmingOrder: string;
      confirmOrderHelp: string;
      paymentStatus: string;
      orderActions: string;
      markPaid: string;
      items: string;
      contactDetails: string;
      customerName: string;
      customerEmail: string;
      customerPhone: string;
      deliveryDetails: string;
      deliveryArea: string;
      deliveryCity: string;
      deliveryAddress: string;
      deliveryNotes: string;
      deliveryPrice: string;
      pickupAgreement: string;
      yes: string;
      notProvided: string;
      notRequired: string;
      adminNote: string;
      adminNotePlaceholder: string;
      saveNote: string;
      saving: string;
      noteWarning: string;
      noImage: string;
      noOrdersTitle: string;
      noOrdersDescription: string;
      selectOrderTitle: string;
      selectOrderDescription: string;
      unavailableTitle: string;
      tryAgain: string;
      failedToLoad: string;
      failedToLoadDetails: string;
      failedToConnect: string;
      failedToUpdateStatus: string;
      failedToUpdatePayment: string;
      failedToSaveNote: string;
      statuses: Record<string, string>;
      paymentStatuses: Record<string, string>;
    };
    products: {
      badge: string;
      title: string;
      description: string;
      backToDashboard: string;
      activeProducts: string;
      archivedProducts: string;
      categories: string;
      createProduct: string;
      createProductDescription: string;
      addProduct: string;
      hideCreateProduct: string;
      manageCategories: string;
      productName: string;
      productNamePlaceholder: string;
      slug: string;
      slugPlaceholder: string;
      make: string;
      descriptionLabel: string;
      descriptionPlaceholder: string;
      price: string;
      discountPrice: string;
      discountPricePlaceholder: string;
      discountPriceHelp: string;
      stock: string;
      stockHelp: string;
      optionsTitle: string;
      optionsDescription: string;
      optionCount: string;
      optionsCountLabel: string;
      optionsCountHelp: string;
      activeOptionStock: string;
      activeOptionStockHelp: string;
      size: string;
      color: string;
      sortOrder: string;
      active: string;
      saveOption: string;
      savingOption: string;
      makeInactive: string;
      makingInactive: string;
      addOption: string;
      addingOption: string;
      sizePlaceholder: string;
      colorPlaceholder: string;
      failedToCreateOption: string;
      optionCreated: string;
      failedToUpdateOption: string;
      optionUpdated: string;
      failedToDeactivateOption: string;
      optionDeactivated: string;
      category: string;
      selectCategory: string;
      featuredProduct: string;
      showStockOnStore: string;
      showStockHelp: string;
      stockHidden: string;
      images: string;
      imageUrlPlaceholder: string;
      addUrl: string;
      imageHelp: string;
      imageTooLarge: string;
      checkHighlightedFields: string;
      invalidProductName: string;
      invalidProductSlug: string;
      productSlugAlreadyUsed: string;
      invalidDescription: string;
      invalidPrice: string;
      invalidDiscountPrice: string;
      invalidCategory: string;
      invalidImage: string;
      invalidOptionSizeOrColor: string;
      invalidOptionStock: string;
      invalidOptionSortOrder: string;
      productPreview: string;
      remove: string;
      createProductButton: string;
      creating: string;
      editProduct: string;
      editProductDescription: string;
      cancel: string;
      saveProduct: string;
      saving: string;
      newCategory: string;
      categoryName: string;
      categoryNamePlaceholder: string;
      categorySlug: string;
      categorySlugPlaceholder: string;
      createCategory: string;
      creatingCategory: string;
      categoryList: string;
      noCategoriesYet: string;
      productList: string;
      productListDescription: string;
      refresh: string;
      search: string;
      searchPlaceholder: string;
      categoryFilter: string;
      allCategories: string;
      statusFilter: string;
      allStatuses: string;
      activeStatus: string;
      archivedStatus: string;
      stockFilter: string;
      allStock: string;
      inStock: string;
      outOfStock: string;
      lowStock: string;
      sortBy: string;
      sortNewest: string;
      sortOldest: string;
      sortNameAsc: string;
      sortNameDesc: string;
      sortPriceAsc: string;
      sortPriceDesc: string;
      sortStockAsc: string;
      sortStockDesc: string;
      applyFilters: string;
      clearFilters: string;
      pageInfo: string;
      previousPage: string;
      nextPage: string;
      totalProducts: string;
      noProductsYet: string;
      noImage: string;
      featured: string;
      archived: string;
      edit: string;
      archive: string;
      archiving: string;
      restore: string;
      restoring: string;
      updateStock: string;
      stockSaving: string;
      failedToLoadProducts: string;
      failedToLoadCategories: string;
      failedToConnect: string;
      failedToUploadImage: string;
      imageUploaded: string;
      failedToCreateProduct: string;
      productCreated: string;
      failedToUpdateProduct: string;
      productUpdated: string;
      failedToArchiveProduct: string;
      productArchived: string;
      failedToRestoreProduct: string;
      productRestored: string;
      failedToUpdateStock: string;
      stockUpdated: string;
      failedToCreateCategory: string;
      categoryCreated: string;
    };
  };
};

export const translations: Record<Language, TranslationDictionary> = {
  en: {
    brand: {
      name: englishStoreName,
    },
    nav: {
      home: "Home",
      products: "Products",
      cart: "Cart",
      orders: "Orders",
      account: "Account",
      mobileNavigation: "Mobile navigation",
    },
    actions: {
      switchToArabic: "عربي",
      switchToEnglish: "EN",
      toggleLanguage: "Switch language",
      lightMode: "Light",
      darkMode: "Dark",
      browseProducts: "Browse products",
      viewCart: "View cart",
      backToProducts: "Back to products",
      clearFilters: "Clear filters",
    },
    footer: {
      rights: "All rights reserved.",
      description:
        "Electronic components for circuits, prototypes and university projects.",
      contactTitle: "Contact us",
      whatsapp: "WhatsApp",
      phone: "Phone",
      email: "Email",
      socialLinks: "Social and location links",
      openSocialLink: "Open contact link:",
      legalLinksLabel: "Store policies and contact links",
      locationNote:
        "Use the location icon to find the store or pickup point. Contact us on WhatsApp or by phone to confirm delivery or pickup details.",
      onlineStoreCtaTitle: "Want an online store for your business?",
      onlineStoreCtaDescription:
        "Show your products, offer size and color options, and let customers order easily with cash on delivery.",
      onlineStoreCtaAction: "Chat with us on WhatsApp",
    },
    whatsappShortcut: {
      label: "Need help?",
      title: "Chat with us on WhatsApp",
      ariaLabel:
        "Open WhatsApp to ask about products, login, or placing an order",
      defaultMessage: `Hi, I need help with a product or order from ${englishStoreName}.`,
    },
    home: {
      badge: "Electronics components",
      titleStart: "Build your next",
      titleBrand: "project",
      description:
        "Explore components for circuits, prototypes and university projects. Browse the catalog for current products, prices and availability.",
      flowTitle: "From idea to circuit",
      highlights: [
        {
          title: "Start with your circuit",
          description:
            "List the parts your design needs, then browse by name or category.",
        },
        {
          title: "Check the exact part",
          description:
            "Review product details and manufacturer documentation for your chosen model.",
        },
        {
          title: "Review and order",
          description:
            "Check your items and delivery details, then place your order.",
        },
      ],
      stats: [
        {
          title: "Boards & prototyping",
          description:
            "Solderless breadboards let you assemble temporary circuits. Check the exact ESP32 board model for its interfaces and wireless features.",
        },
        {
          title: "Motors, ICs & sensors",
          description:
            "Match motors to a suitable driver. Check the pinout and electrical ratings of ICs and sensors against your design.",
        },
        {
          title: "University projects & kits",
          description:
            "Use your project brief to build a parts list. Check each kit’s listed contents before choosing additional components.",
        },
      ],
    },
    products: {
      badge: "Component catalog",
      title: "Find parts for your project",
      description:
        "Search by product name or category. Open a product to review its details, images and available options.",
      searchLabel: "Search components",
      searchPlaceholder: "Search by name or category...",
      searchButton: "Search",
      loadMore: "Show more",
      loadingMore: "Loading...",
      allProducts: "All products",
      selectedCategory: "Selected category",
      showing: "Showing",
      productSingular: "product",
      productPlural: "products",
      noProductsTitle: "No matching products",
      noProductsDescription:
        "Try another category or search with a different word.",
      failedToLoad: "Failed to load products.",
      failedToConnect: "Failed to connect to the server.",
      noImage: "No product image",
      featured: "Featured",
      soldOut: "Sold out",
      out: "Out",
      left: "left",
      inStock: "Available",
      options: "Options",
      optionsAvailable: "Options available",
      size: "Size",
      color: "Color",
      option: "Option",
      selected: "Selected",
      selectOptionHelp:
        "Choose an available variant before adding this piece to your cart.",
      selectOptionRequired:
        "Please choose an available size or color option before adding to cart.",
      outOfStock: "Out of stock",
      descriptionTitle: "Description",
      noDescription: "No description available for this product yet.",
      payment: "Payment",
      cashOnDelivery: "Cash on delivery",
      category: "Category",
      productId: "Product ID",
      stockNote:
        "Adding to cart does not reserve stock. Stock is checked again when the order is placed.",
      productNotFound: "Product not found",
      productUnavailable:
        "This product is unavailable or may have been removed.",
      image: "Image",
      of: "of",
    },
    cart: {
      badge: "Checkout",
      title: "Your cart",
      description: "Review your items before placing a cash-on-delivery order.",
      itemSingular: "item",
      itemPlural: "items",
      cartUnavailable: "Cart unavailable",
      tryAgain: "Try again",
      emptyTitle: "Your cart is empty",
      emptyDescription:
        "Add products to your cart first, then come back here to place your order.",
      orderPlacedTitle: "Order placed successfully",
      orderPlacedDescription:
        "Your order was received. The store owner will confirm it with you by WhatsApp or phone before processing.",
      orderId: "Order ID",
      total: "Total",
      payment: "Payment",
      status: "Status",
      viewOrders: "View my orders",
      continueShopping: "Continue shopping",
      unavailableNotice:
        "Some items are unavailable or exceed current stock. Remove them or reduce their quantity before placing the order.",
      each: "each",
      subtotal: "Subtotal",
      remove: "Remove",
      removing: "Removing...",
      noImage: "No image",
      productArchived: "This product is no longer available.",
      productOutOfStock: "This product is currently out of stock.",
      onlyLeft: "Only {stock} left in stock.",
      orderSummary: "Order summary",
      items: "Items",
      paymentMethod: "Payment method",
      estimatedTotal: "Estimated total",
      cashOnDelivery: "Cash on delivery",
      placeOrder: "Place order",
      placingOrder: "Placing order...",
      orderPlacedButton: "Order placed",
      stockServerNote:
        "Stock and prices are checked on the server. Stock is reserved when the order is placed, then the store owner confirms it by WhatsApp or phone.",
      failedToLoad: "Failed to load cart.",
      failedToConnect: "Failed to connect to the server.",
      failedToUpdate: "Failed to update item.",
      failedToRemove: "Failed to remove item.",
      failedToPlaceOrder: "Failed to place order.",
      failedToAddItem: "Failed to add item to cart.",
      itemAddedToCart: "Item added to cart.",
      addingToCart: "Adding...",
      chooseOption: "Choose an option",
      addToCart: "Add to cart",
      quantityHelp: "Choose quantity, then add the item to your cart.",
      requestedQuantityUnavailable:
        "The selected quantity is not currently available.",
      decreaseQuantity: "Decrease quantity",
      increaseQuantity: "Increase quantity",
      deliveryDetailsTitle: "Delivery details",
      deliveryDetailsDescription:
        "Choose the delivery area and add the address details needed to complete the order.",
      deliveryArea: "Delivery area",
      deliveryCity: "City or area",
      deliveryCityPlaceholder: "Example: Nablus",
      deliveryAddress: "Delivery address",
      deliveryAddressOptional: "Address/details (optional for pickup)",
      deliveryAddressPlaceholder:
        "Street, building, nearby landmark, or pickup details",
      deliveryNotes: "Delivery notes",
      deliveryNotesPlaceholder: "Optional notes for the store owner",
      productsTotal: "Products total",
      deliveryPrice: "Delivery price",
      finalTotal: "Final total",
      reviewOrder: "Review order",
      confirmOrderTitle: "Confirm your order",
      confirmOrderDescription:
        "Review each product, selected option, quantity, unit price, delivery details, and final total before placing the order.",
      contactInfo: "Contact info",
      customerName: "Name",
      customerEmail: "Email",
      customerPhone: "Phone",
      savedAccountContact:
        "These details come from your account and may be used by the store owner to confirm the order.",
      cancel: "Cancel",
      confirmPlaceOrder: "Confirm and place order",
      deliveryCityRequired: "Please enter the city or area.",
      deliveryAddressRequired: "Please enter a delivery address.",
      pickupAgreementRequired:
        "Please agree or coordinate with the store owner on WhatsApp before choosing the Nablus receive point.",
      reviewItemsTitle: "Products in this order",
      quantity: "Quantity",
      selectedOption: "Selected option",
      unitPrice: "Unit price",
      lineTotal: "Line total",
      currency: "Currency",
      deliveryMethod: "Delivery method",
      estimatedDelivery: "Estimated delivery",
      deliveryConditions: "Delivery conditions",
      taxInformation: "Tax information",
      complaintsHelp: "Questions or complaints about this order?",
      contactStore: "Contact the store",
    },
    delivery: {
      currency: getDeliveryCurrencyLabel("en"),
      free: getFreeDeliveryLabel("en"),
      method: getDeliveryMethodLabel("en"),
      estimatedDuration: getEstimatedDeliveryDuration("en"),
      areas: getDeliveryAreaLabels("en"),
    },
    orders: {
      badge: "Account",
      title: "My orders",
      description:
        "Track your order history, payment status, and purchased items.",
      totalOrders: "Total orders",
      activeOrders: "Active orders",
      totalSpent: "Total spent",
      ordersUnavailable: "Orders unavailable",
      tryAgain: "Try again",
      noOrdersTitle: "No orders yet",
      noOrdersDescription:
        "When you place an order, it will appear here with its status, payment state, and product details.",
      browseProducts: "Browse products",
      refresh: "Refresh",
      loadMore: "Load more orders",
      loadingMore: "Loading…",
      order: "Order",
      placed: "Placed",
      total: "Total",
      payment: "Payment",
      items: "Items",
      quantity: "Quantity",
      subtotal: "Subtotal",
      noImage: "No image",
      deliveryDetails: "Delivery details",
      deliveryArea: "Delivery area",
      deliveryCity: "City or area",
      deliveryAddress: "Delivery address",
      deliveryNotes: "Delivery notes",
      deliveryPrice: "Delivery price",
      pickupAgreement: "Pickup agreement",
      yes: "Yes",
      notProvided: "Not provided",
      notRequired: "Not required",
      failedToLoad: "Failed to load orders.",
      failedToConnect: "Failed to connect to the server.",
      statuses: {
        PENDING: "Pending",
        PROCESSING: "Processing",
        SHIPPED: "Shipped",
        DELIVERED: "Delivered",
        CANCELLED: "Cancelled",
      },
      paymentMethods: {
        CASH_ON_DELIVERY: "Cash on delivery",
      },
      paymentStatuses: {
        UNPAID: "Unpaid",
        PAID: "Paid",
      },
    },
    auth: {
      welcomeBackBadge: "Welcome back",
      loginHeroTitle: "Sign in and continue shopping.",
      loginHeroDescription: `Access your cart, checkout, and order history using your ${englishStoreName} account.`,
      loginTitle: "Login",
      loginDescription: "Enter your email and password to access your account.",
      email: "Email",
      password: "Password",
      name: "Name",
      phone: "Phone number",
      phoneHelp: "The admin may use this number to confirm your order.",
      nameInvalid: "Enter your name using 2 to 50 characters.",
      emailInvalid: "Enter a valid email address.",
      phoneInvalid:
        "Enter a valid phone number using digits, spaces, dashes, parentheses, and an optional + at the start.",
      passwordRequired: "Enter your password.",
      passwordTooShort: "Password must be at least 8 characters.",
      fixHighlightedFields: "Please fix the highlighted fields.",
      invalidRegistrationInput:
        "Some registration details are invalid. Please review the highlighted fields.",
      login: "Login",
      loggingIn: "Logging in...",
      continueWithGoogle: "Continue with Google",
      continuingWithGoogle: "Opening Google...",
      orContinueWithEmail: "Or continue with email",
      googleSignInFailed: "Failed to start Google sign-in. Please try again.",
      invalidLogin: "Invalid email or password.",
      noAccount: "Don't have an account?",
      createOne: "Create one",
      registerBadge: `Join ${englishStoreName}`,
      registerHeroTitle: "Create an account before checkout.",
      registerHeroDescription:
        "Your account lets you save your cart, place orders, and view order history.",
      registerTitle: "Register",
      registerDescription: "Create your customer account.",
      createAccount: "Create account",
      creatingAccount: "Creating account...",
      alreadyHaveAccount: "Already have an account?",
      passwordPlaceholder: "At least 8 characters",
      passwordHelp:
        "Use a strong password. The server must hash it before saving.",
      registerSuccess: "Account created successfully. Redirecting to login...",
      registerVerifyEmailSuccess:
        "Account created. Please check your email to verify your account.",
      failedToRegister: "Failed to create account.",
      failedToConnect: "Failed to connect to the server.",
      signOut: "Sign out",
      signingOut: "Signing out...",
      forgotPassword: "Forgot password?",
      forgotPasswordBadge: "Account recovery",
      forgotPasswordHeroTitle: "Reset your password securely.",
      forgotPasswordHeroDescription:
        "Enter your account email and we will send a reset link. In development, the link appears in your terminal because SMTP is not configured yet.",
      forgotPasswordTitle: "Forgot password?",
      forgotPasswordDescription:
        "Enter your email address and check your inbox for a reset link.",
      sendResetLink: "Send reset link",
      sendingResetLink: "Sending reset link...",
      resetRequestSuccess:
        "If an account exists with this email, a password reset link has been sent.",
      resetRequestFailed: "Failed to request password reset. Please try again.",
      rememberPassword: "Remember your password?",
      backToLogin: "Back to login",
      setNewPasswordBadge: "Set new password",
      setNewPasswordHeroTitle: "Choose a new secure password.",
      setNewPasswordHeroDescription:
        "Use at least 8 characters. After reset, old sessions are revoked by the auth configuration.",
      resetPasswordTitle: "Reset password",
      resetPasswordDescription: "Enter your new password below.",
      newPassword: "New password",
      confirmPassword: "Confirm password",
      repeatPassword: "Repeat password",
      resetPassword: "Reset password",
      resettingPassword: "Resetting password...",
      resetMissingToken: "This reset link is missing a token.",
      resetPasswordTooShort: "Password must be at least 8 characters.",
      passwordsDoNotMatch: "Passwords do not match.",
      resetPasswordFailed: "Failed to reset password.",
      resetPasswordSuccess:
        "Password reset successfully. Redirecting to login...",
      invalidResetLink:
        "This reset link is invalid or expired. Please request a new one.",
      requestNewResetLink: "Request a new reset link",
      loadingResetForm: "Loading reset form...",
    },
    account: {
      badge: "Account",
      title: "My account",
      description: "View your account details and quick links.",
      quickActions: "Quick actions",
      browseProducts: "Browse products",
      browseProductsDescription:
        "Continue shopping and add items to your cart.",
      viewCart: "View cart",
      viewCartDescription: "Review items before placing an order.",
      myOrders: "My orders",
      myOrdersDescription: "Track order status and payment state.",
      adminDashboard: "Admin dashboard",
      adminDashboardDescription: "Manage products, orders, and store data.",
      noEmail: "No email available",
      customer: "Customer",
      accountSetupRequired: "Account setup required before checkout",
      accountSetupDescription:
        "You can browse products and manage your account, but checkout requires a verified email and a phone number so the store admin can confirm your order.",
      emailVerification: "Email verification",
      verified: "verified",
      notVerified: "not verified",
      phoneNumber: "Phone number",
      added: "added",
      missing: "missing",
      updateProfile: "Update profile",
      updateProfileDescription:
        "Add or update your phone number before checkout.",
      sendingVerificationEmail: "Sending verification email...",
      resendVerificationEmail: "Resend verification email",
      failedToSendVerificationEmail: "Failed to send verification email.",
      verificationEmailSent:
        "Verification email sent. Check your inbox, or check the terminal in development.",
      emailStatus: "Email status",
      phone: "Phone",
      notAdded: "Not added",
    },
    profile: {
      badge: "Profile",
      title: "Update your profile",
      description:
        "Your phone number is used by the store admin to confirm cash-on-delivery orders.",
      emailStatus: "Email status",
      verified: "Verified",
      notVerified: "Not verified",
      emailChangeHelp:
        "Email changes will be added later because they need a separate verification flow.",
      name: "Name",
      phoneNumber: "Phone number",
      phoneHelp:
        "Phone numbers are required before checkout. They are not verified by SMS yet.",
      nameInvalid: "Enter your name using 2 to 50 characters.",
      phoneInvalid:
        "Enter a valid phone number using digits, spaces, dashes, parentheses, and an optional + at the start.",
      fixHighlightedFields: "Please fix the highlighted fields.",
      saveProfile: "Save profile",
      saving: "Saving...",
      backToAccount: "Back to account",
      failedToUpdate: "Failed to update profile.",
      updatedSuccessfully: "Profile updated successfully.",
      failedToConnect: "Failed to connect to the server.",
    },
    legal: englishLegal,

    admin: {
      dashboard: {
        badge: "Admin",
        title: "Store dashboard",
        description:
          "Manage products, orders, stock, payment state, and customer requests.",
        productsTitle: "Products",
        productsBadge: "Catalog",
        productsDescription:
          "Create, update, archive, restore, and manage stock for products.",
        ordersTitle: "Orders",
        ordersBadge: "Sales",
        ordersDescription:
          "Review customer orders, update order status, payment state, and internal notes.",
        categoriesTitle: "Categories",
        categoriesBadge: "Catalog",
        categoriesDescription:
          "Create, rename, and safely delete categories when no products are using them.",
      },
      categories: {
        badge: "Admin",
        title: "Categories",
        description:
          "Manage product categories. Deleting is blocked when products are still connected to the category.",
        backToDashboard: "Back to dashboard",
        createTitle: "Create category",
        createDescription:
          "Add a new category for products. Use a lowercase slug for clean URLs and filters.",
        name: "Name",
        namePlaceholder: "Tops",
        slug: "Slug",
        slugPlaceholder: "tops",
        make: "Make",
        createButton: "Create category",
        creating: "Creating...",
        editTitle: "Edit category",
        editDescription:
          "Changes affect product filters and future browsing. Existing order snapshots are not changed.",
        saveButton: "Save category",
        saving: "Saving...",
        cancel: "Cancel",
        listTitle: "Category list",
        listDescription:
          "Categories with connected products cannot be deleted. Move or archive related products first.",
        refresh: "Refresh",
        search: "Search",
        searchPlaceholder: "Search by category name or slug...",
        usageFilter: "Usage",
        allUsage: "All categories",
        withProducts: "With products",
        emptyCategories: "Empty categories",
        sortBy: "Sort by",
        sortNameAsc: "Name A-Z",
        sortNameDesc: "Name Z-A",
        sortNewest: "Newest first",
        sortOldest: "Oldest first",
        applyFilters: "Apply filters",
        clearFilters: "Clear filters",
        pageInfo: "Page {page} of {totalPages}",
        previousPage: "Previous",
        nextPage: "Next",
        totalCategories: "{count} categories",
        noCategoriesYet: "No categories yet.",
        productCount: "{count} connected products",
        deleteBlockedHint:
          "Delete is blocked because products are using this category.",
        edit: "Edit",
        delete: "Delete",
        deleting: "Deleting...",
        deleteConfirm: "Delete this category? This cannot be undone.",
        cannotDeleteWithProducts:
          "This category cannot be deleted while products are connected to it.",
        failedToLoad: "Failed to load categories.",
        failedToConnect: "Failed to connect to the server.",
        failedToCreate: "Failed to create category.",
        created: "Category created successfully.",
        failedToUpdate: "Failed to update category.",
        updated: "Category updated successfully.",
        failedToDelete: "Failed to delete category.",
        deleted: "Category deleted successfully.",
      },
      orders: {
        badge: "Admin",
        title: "Orders",
        description:
          "Review orders, update shipping status, mark payments, and keep private admin notes.",
        dashboard: "Dashboard",
        refresh: "Refresh",
        search: "Search",
        searchPlaceholder:
          "Search by order ID, customer, phone, email, or city...",
        statusFilter: "Status",
        allStatuses: "All statuses",
        paymentFilter: "Payment",
        allPaymentStatuses: "All payments",
        applyFilters: "Apply",
        clearFilters: "Clear",
        orderCards: "Order cards",
        pageInfo: "Page {page} of {totalPages}",
        previousPage: "Previous",
        nextPage: "Next",
        currentPageOnly: "Current page only",
        totalOrders: "Total orders",
        pendingOrders: "Pending orders",
        revenueExcludingCancelled: "Revenue excluding cancelled",
        unpaidNotice: "{count} order{plural} still marked as unpaid.",
        order: "Order",
        placed: "Placed",
        customer: "Customer",
        unnamedCustomer: "Unnamed customer",
        total: "Total",
        orderStatus: "Order status",
        confirmOrder: "Confirm order",
        confirmingOrder: "Confirming...",
        confirmOrderHelp:
          "Confirm only after contacting the customer. This will deduct stock and move the order to processing.",
        paymentStatus: "Payment status",
        orderActions: "Order actions",
        markPaid: "Mark as paid",
        items: "Items",
        contactDetails: "Contact details",
        customerName: "Customer name",
        customerEmail: "Customer email",
        customerPhone: "Customer phone",
        deliveryDetails: "Delivery details",
        deliveryArea: "Delivery area",
        deliveryCity: "City or area",
        deliveryAddress: "Delivery address",
        deliveryNotes: "Delivery notes",
        deliveryPrice: "Delivery price",
        pickupAgreement: "Pickup agreement",
        yes: "Yes",
        notProvided: "Not provided",
        notRequired: "Not required",
        adminNote: "Admin note",
        adminNotePlaceholder: "Private note for admins only...",
        saveNote: "Save note",
        saving: "Saving...",
        noteWarning:
          "This note is for admins only. Never store passwords, payment card details, or private secrets here.",
        noImage: "No image",
        noOrdersTitle: "No orders yet",
        noOrdersDescription:
          "Customer orders will appear here after checkout or when filters match existing orders.",
        selectOrderTitle: "Select an order",
        selectOrderDescription:
          "Choose an order card to review details and update its admin state.",
        unavailableTitle: "Admin orders unavailable",
        tryAgain: "Try again",
        failedToLoad: "Failed to load admin orders.",
        failedToLoadDetails: "Failed to load order details.",
        failedToConnect: "Failed to connect to the server.",
        failedToUpdateStatus: "Failed to update order status.",
        failedToUpdatePayment: "Failed to update payment status.",
        failedToSaveNote: "Failed to save admin note.",
        statuses: {
          PENDING: "Pending",
          PROCESSING: "Processing",
          SHIPPED: "Shipped",
          DELIVERED: "Delivered",
          CANCELLED: "Cancelled",
        },
        paymentStatuses: {
          UNPAID: "Unpaid",
          PAID: "Paid",
        },
      },
      products: {
        badge: "Admin",
        title: "Products",
        description:
          "Manage product creation, editing, stock, archive state, categories, and product images.",
        backToDashboard: "Back to dashboard",
        activeProducts: "Active products",
        archivedProducts: "Archived products",
        categories: "Categories",
        createProduct: "Create product",
        createProductDescription:
          "Keep this closed during daily stock work. Open it only when adding a new clothing item.",
        addProduct: "Add product",
        hideCreateProduct: "Hide form",
        manageCategories: "Manage categories",
        productName: "Product name",
        productNamePlaceholder: "Classic cotton t-shirt",
        slug: "Slug",
        slugPlaceholder: "classic-cotton-t-shirt",
        make: "Make",
        descriptionLabel: "Description",
        descriptionPlaceholder: "Write a clear customer-facing description.",
        price: "Price",
        discountPrice: "Discount price",
        discountPricePlaceholder: "Optional sale price",
        discountPriceHelp:
          "Leave empty for no discount. Must be lower than the regular price.",
        stock: "Stock",
        stockHelp:
          "Manage stock in Options after saving the product. Customers can order only active size/color options with stock.",
        optionsTitle: "Options",
        optionsDescription:
          "Manage sizes, colors, stock, and active status. Customers can order only active options with stock.",
        optionCount: "{count} options",
        optionsCountLabel: "Options",
        optionsCountHelp:
          "Each option represents a customer choice such as size, color, or both.",
        activeOptionStock: "Active option stock",
        activeOptionStockHelp:
          "This is the customer-facing stock total when exact stock visibility is enabled.",
        size: "Size",
        color: "Color",
        sortOrder: "Sort order",
        active: "Active",
        saveOption: "Save option",
        savingOption: "Saving...",
        makeInactive: "Make inactive",
        makingInactive: "Saving...",
        addOption: "Add option",
        addingOption: "Adding...",
        sizePlaceholder: "Size, e.g. M",
        colorPlaceholder: "Color, e.g. Black",
        failedToCreateOption: "Failed to create option.",
        optionCreated: "Option created successfully.",
        failedToUpdateOption: "Failed to update option.",
        optionUpdated: "Option updated successfully.",
        failedToDeactivateOption: "Failed to make option inactive.",
        optionDeactivated: "Option is now inactive.",
        category: "Category",
        selectCategory: "Select category",
        featuredProduct: "Featured product",
        showStockOnStore: "Show stock count to customers",
        showStockHelp:
          "When off, customers see availability without the exact number. Admin stock stays visible here.",
        stockHidden: "Stock hidden",
        images: "Images",
        imageUrlPlaceholder: "https://...",
        addUrl: "Add URL",
        imageHelp:
          "JPG, PNG, or WEBP. Max 10MB. Uploaded images are optimized by Cloudinary after upload.",
        imageTooLarge:
          "Image is too large. Please upload a JPG, PNG, or WEBP image up to {size}MB.",
        checkHighlightedFields: "Please check the highlighted fields.",
        invalidProductName: "Enter a product name.",
        invalidProductSlug:
          "Use lowercase letters, numbers, and hyphens only. Example: classic-shirt.",
        productSlugAlreadyUsed: "This product slug is already used.",
        invalidDescription: "Description is too long.",
        invalidPrice: "Enter a valid price.",
        invalidDiscountPrice:
          "Discount price must be lower than the regular price.",
        invalidCategory: "Select a category.",
        invalidImage: "Upload a valid JPG, PNG, or WEBP image up to 10MB.",
        invalidOptionSizeOrColor: "Enter at least a size or color.",
        invalidOptionStock: "Enter a valid whole stock number.",
        invalidOptionSortOrder: "Enter a valid whole sort order.",
        productPreview: "Product preview",
        remove: "Remove",
        createProductButton: "Create product",
        creating: "Creating...",
        editProduct: "Edit product",
        editProductDescription:
          "You are editing an existing product. Changes affect future shoppers, not historical order snapshots.",
        cancel: "Cancel",
        saveProduct: "Save product",
        saving: "Saving...",
        newCategory: "New category",
        categoryName: "Name",
        categoryNamePlaceholder: "Tops",
        categorySlug: "Slug",
        categorySlugPlaceholder: "tops",
        createCategory: "Create category",
        creatingCategory: "Creating...",
        categoryList: "Category list",
        noCategoriesYet: "No categories yet.",
        productList: "Product list",
        productListDescription:
          "Archive hides products from public browsing without deleting past order history.",
        refresh: "Refresh",
        search: "Search",
        searchPlaceholder: "Search by product name, slug, or description...",
        categoryFilter: "Category",
        allCategories: "All categories",
        statusFilter: "Status",
        allStatuses: "All statuses",
        activeStatus: "Active",
        archivedStatus: "Archived",
        stockFilter: "Stock",
        allStock: "All stock",
        inStock: "In stock",
        outOfStock: "Out of stock",
        lowStock: "Low stock",
        sortBy: "Sort by",
        sortNewest: "Newest first",
        sortOldest: "Oldest first",
        sortNameAsc: "Name A-Z",
        sortNameDesc: "Name Z-A",
        sortPriceAsc: "Price low-high",
        sortPriceDesc: "Price high-low",
        sortStockAsc: "Stock low-high",
        sortStockDesc: "Stock high-low",
        applyFilters: "Apply filters",
        clearFilters: "Clear filters",
        pageInfo: "Page {page} of {totalPages}",
        previousPage: "Previous",
        nextPage: "Next",
        totalProducts: "{count} products",
        noProductsYet: "No products yet.",
        noImage: "No image",
        featured: "Featured",
        archived: "Archived",
        edit: "Edit",
        archive: "Archive",
        archiving: "Archiving...",
        restore: "Restore",
        restoring: "Restoring...",
        updateStock: "Update stock",
        stockSaving: "Saving...",
        failedToLoadProducts: "Failed to load products.",
        failedToLoadCategories: "Failed to load categories.",
        failedToConnect: "Failed to connect to the server.",
        failedToUploadImage: "Failed to upload product image.",
        imageUploaded: "Image uploaded successfully.",
        failedToCreateProduct: "Failed to create product.",
        productCreated: "Product created successfully.",
        failedToUpdateProduct: "Failed to update product.",
        productUpdated: "Product updated successfully.",
        failedToArchiveProduct: "Failed to archive product.",
        productArchived: "Product archived successfully.",
        failedToRestoreProduct: "Failed to restore product.",
        productRestored: "Product restored successfully.",
        failedToUpdateStock: "Failed to update stock.",
        stockUpdated: "Stock updated successfully.",
        failedToCreateCategory: "Failed to create category.",
        categoryCreated: "Category created successfully.",
      },
    },
  },
  ar: {
    brand: {
      name: arabicStoreName,
    },
    nav: {
      home: "الرئيسية",
      products: "المنتجات",
      cart: "السلة",
      orders: "طلباتي",
      account: "الحساب",
      mobileNavigation: "التنقل على الجوال",
    },
    actions: {
      switchToArabic: "عربي",
      switchToEnglish: "EN",
      toggleLanguage: "تغيير اللغة",
      lightMode: "فاتح",
      darkMode: "داكن",
      browseProducts: "تصفح المنتجات",
      viewCart: "عرض السلة",
      backToProducts: "العودة إلى المنتجات",
      clearFilters: "مسح الفلاتر",
    },
    footer: {
      rights: "جميع الحقوق محفوظة.",
      description:
        "مكوّنات إلكترونية للدوائر والنماذج الأولية والمشاريع الجامعية.",
      contactTitle: "تواصل معنا",
      whatsapp: "واتساب",
      phone: "الهاتف",
      email: "البريد الإلكتروني",
      socialLinks: "روابط التواصل والموقع",
      openSocialLink: "افتح رابط التواصل:",
      legalLinksLabel: "سياسات المتجر وروابط التواصل",
      locationNote:
        "اضغط على أيقونة الموقع للوصول للمتجر أو نقطة الاستلام. تفاصيل التوصيل أو الاستلام بنأكدها معك على واتساب أو الهاتف.",
      onlineStoreCtaTitle: "بدك متجر إلكتروني لمشروعك؟",
      onlineStoreCtaDescription:
        "اعرض منتجاتك وخيارات المقاسات والألوان، وخلي الزبائن يطلبوا بسهولة مع الدفع عند الاستلام.",
      onlineStoreCtaAction: "احكي معنا على واتساب",
    },
    whatsappShortcut: {
      label: "بدك مساعدة؟",
      title: "احكي معنا على واتساب",
      ariaLabel:
        "افتح واتساب واسألنا عن المنتجات أو تسجيل الدخول أو طريقة الطلب",
      defaultMessage: `مرحبا، بدي مساعدة بخصوص قطعة أو طلب من ${arabicStoreName}.`,
    },
    home: {
      badge: "مكوّنات إلكترونية",
      titleStart: "ابدأ بناء",
      titleBrand: "مشروعك القادم",
      description:
        "استكشف مكوّنات للدوائر والنماذج الأولية والمشاريع الجامعية. تصفّح الكتالوج للاطلاع على المنتجات والأسعار والتوفر الحالي.",
      flowTitle: "من الفكرة إلى الدائرة",
      highlights: [
        {
          title: "ابدأ بدائرتك",
          description:
            "حدّد القطع التي يحتاجها تصميمك، ثم ابحث بالاسم أو التصنيف.",
        },
        {
          title: "تحقّق من القطعة",
          description:
            "راجع تفاصيل المنتج ووثائق الشركة المصنّعة للطراز الذي اخترته.",
        },
        {
          title: "راجع واطلب",
          description: "تأكد من القطع وتفاصيل التوصيل، وبعدها كمّل طلبك.",
        },
      ],
      stats: [
        {
          title: "اللوحات وتجربة الدوائر",
          description:
            "تتيح لوحات التجارب دون لحام تركيب دوائر مؤقتة. تحقّق من طراز لوحة ESP32 المحدّد لمعرفة واجهاتها وميزاتها اللاسلكية.",
        },
        {
          title: "المحرّكات والدوائر المتكاملة والحسّاسات",
          description:
            "اختر مشغّلاً مناسباً للمحرّك. راجع توزيع الأطراف والقيم الكهربائية للدوائر المتكاملة والحسّاسات وفق تصميمك.",
        },
        {
          title: "المشاريع الجامعية والأطقم",
          description:
            "استخدم متطلبات مشروعك لإعداد قائمة القطع. راجع محتويات كل طقم قبل اختيار مكوّنات إضافية.",
        },
      ],
    },
    products: {
      badge: "كتالوج المكوّنات",
      title: "ابحث عن قطع لمشروعك",
      description:
        "ابحث باسم المنتج أو التصنيف. افتح المنتج لمراجعة تفاصيله وصوره وخياراته المتوفرة.",
      searchLabel: "دور على منتج",
      searchPlaceholder: "اكتب اسم القطعة أو التصنيف...",
      searchButton: "بحث",
      loadMore: "عرض المزيد",
      loadingMore: "جاري التحميل...",
      allProducts: "كل المنتجات",
      selectedCategory: "التصنيف المختار",
      showing: "النتائج:",
      productSingular: "منتج",
      productPlural: "منتجات",
      noProductsTitle: "ما لقينا منتجات",
      noProductsDescription: "جرّب تغيّر التصنيف أو ابحث بكلمة ثانية.",
      failedToLoad: "فشل تحميل المنتجات.",
      failedToConnect: "فشل الاتصال بالخادم.",
      noImage: "لا توجد صورة للمنتج",
      featured: "مميز",
      soldOut: "نفذ المخزون",
      out: "غير متوفر",
      left: "متبقي",
      inStock: "متوفر",
      options: "الخيارات",
      optionsAvailable: "خيارات متوفرة",
      size: "المقاس",
      color: "اللون",
      option: "خيار",
      selected: "محدد",
      selectOptionHelp: "اختار نوع قبل ما تضيف القطعة للسلة.",
      selectOptionRequired: "اختار مقاس أو لون متوفر قبل ما تضيف القطعة للسلة.",
      outOfStock: "غير متوفر",
      descriptionTitle: "الوصف",
      noDescription: "ما في وصف لهاي القطعة حالياً.",
      payment: "الدفع",
      cashOnDelivery: "الدفع عند الاستلام",
      category: "التصنيف",
      productId: "رقم المنتج",
      stockNote:
        "الإضافة إلى السلة لا تحجز المخزون. يتم فحص المخزون مرة أخرى عند إنشاء الطلب.",
      productNotFound: "المنتج غير موجود",
      productUnavailable: "هذا المنتج غير متوفر أو ربما تمت إزالته.",
      image: "الصورة",
      of: "من",
    },
    cart: {
      badge: "الدفع",
      title: "سلتك",
      description: "راجع المنتجات قبل إنشاء طلب الدفع عند الاستلام.",
      itemSingular: "منتج",
      itemPlural: "منتجات",
      cartUnavailable: "السلة غير متاحة",
      tryAgain: "حاول مرة أخرى",
      emptyTitle: "السلة فارغة",
      emptyDescription: "أضف منتجات إلى السلة أولاً، ثم ارجع هنا لإنشاء الطلب.",
      orderPlacedTitle: "تم إنشاء الطلب بنجاح",
      orderPlacedDescription:
        "تم استلام طلبك. سيتواصل معك صاحب المتجر عبر واتساب أو الهاتف لتأكيد الطلب قبل معالجته.",
      orderId: "رقم الطلب",
      total: "المجموع",
      payment: "الدفع",
      status: "الحالة",
      viewOrders: "عرض طلباتي",
      continueShopping: "متابعة التسوق",
      unavailableNotice:
        "بعض المنتجات غير متوفرة أو تتجاوز المخزون الحالي. احذفها أو قلل الكمية قبل إنشاء الطلب.",
      each: "للقطعة",
      subtotal: "المجموع الفرعي",
      remove: "حذف",
      removing: "جار الحذف...",
      noImage: "لا توجد صورة",
      productArchived: "هذا المنتج لم يعد متاحاً.",
      productOutOfStock: "هذا المنتج غير متوفر حالياً.",
      onlyLeft: "متبقي {stock} فقط في المخزون.",
      orderSummary: "ملخص الطلب",
      items: "المنتجات",
      paymentMethod: "طريقة الدفع",
      estimatedTotal: "المجموع المتوقع",
      cashOnDelivery: "الدفع عند الاستلام",
      placeOrder: "إنشاء الطلب",
      placingOrder: "جار إنشاء الطلب...",
      orderPlacedButton: "تم إنشاء الطلب",
      stockServerNote:
        "يتم فحص المخزون والأسعار من الخادم. يتم حجز المخزون عند إنشاء الطلب، ثم يؤكد صاحب المتجر الطلب عبر واتساب أو الهاتف.",
      failedToLoad: "فشل تحميل السلة.",
      failedToConnect: "فشل الاتصال بالخادم.",
      failedToUpdate: "فشل تحديث المنتج.",
      failedToRemove: "فشل حذف المنتج.",
      failedToPlaceOrder: "فشل إنشاء الطلب.",
      failedToAddItem: "فشل إضافة المنتج إلى السلة.",
      itemAddedToCart: "تمت إضافة المنتج إلى السلة.",
      addingToCart: "جار الإضافة...",
      chooseOption: "اختر خياراً",
      addToCart: "إضافة إلى السلة",
      quantityHelp: "اختر الكمية ثم أضف المنتج إلى السلة.",
      requestedQuantityUnavailable: "الكمية المحددة غير متوفرة حالياً.",
      decreaseQuantity: "تقليل الكمية",
      increaseQuantity: "زيادة الكمية",
      deliveryDetailsTitle: "تفاصيل التوصيل",
      deliveryDetailsDescription:
        "اختر منطقة التوصيل وأضف تفاصيل العنوان اللازمة لإكمال الطلب.",
      deliveryArea: "منطقة التوصيل",
      deliveryCity: "المدينة أو المنطقة",
      deliveryCityPlaceholder: "مثال: نابلس",
      deliveryAddress: "عنوان التوصيل",
      deliveryAddressOptional: "العنوان/التفاصيل (اختياري للاستلام)",
      deliveryAddressPlaceholder:
        "الشارع، المبنى، علامة قريبة، أو تفاصيل الاستلام",
      deliveryNotes: "ملاحظات التوصيل",
      deliveryNotesPlaceholder: "ملاحظات اختيارية لصاحب المتجر",
      productsTotal: "مجموع المنتجات",
      deliveryPrice: "سعر التوصيل",
      finalTotal: "المجموع النهائي",
      reviewOrder: "مراجعة الطلب",
      confirmOrderTitle: "تأكيد الطلب",
      confirmOrderDescription:
        "راجع كل منتج، الخيار المحدد، الكمية، سعر القطعة، تفاصيل التوصيل، والمجموع النهائي قبل إنشاء الطلب.",
      contactInfo: "معلومات التواصل",
      customerName: "الاسم",
      customerEmail: "البريد الإلكتروني",
      customerPhone: "الهاتف",
      savedAccountContact:
        "هذه التفاصيل مأخوذة من حسابك وقد يستخدمها صاحب المتجر لتأكيد الطلب.",
      cancel: "إلغاء",
      confirmPlaceOrder: "تأكيد وإنشاء الطلب",
      deliveryCityRequired: "يرجى إدخال المدينة أو المنطقة.",
      deliveryAddressRequired: "يرجى إدخال عنوان التوصيل.",
      pickupAgreementRequired:
        "يرجى الموافقة أو التنسيق مع صاحب المتجر عبر واتساب قبل اختيار نقطة الاستلام في نابلس.",
      reviewItemsTitle: "المنتجات في هذا الطلب",
      quantity: "الكمية",
      selectedOption: "الخيار المحدد",
      unitPrice: "سعر القطعة",
      lineTotal: "مجموع السطر",
      currency: "العملة",
      deliveryMethod: "طريقة التوصيل",
      estimatedDelivery: "مدة التوصيل المتوقعة",
      deliveryConditions: "شروط التوصيل",
      taxInformation: "معلومات الضرائب",
      complaintsHelp: "عندك سؤال أو شكوى بخصوص هذا الطلب؟",
      contactStore: "تواصل مع المتجر",
    },
    delivery: {
      currency: getDeliveryCurrencyLabel("ar"),
      free: getFreeDeliveryLabel("ar"),
      method: getDeliveryMethodLabel("ar"),
      estimatedDuration: getEstimatedDeliveryDuration("ar"),
      areas: getDeliveryAreaLabels("ar"),
    },
    orders: {
      badge: "الحساب",
      title: "طلباتي",
      description: "تابع سجل الطلبات، حالة الدفع، والمنتجات التي اشتريتها.",
      totalOrders: "إجمالي الطلبات",
      activeOrders: "الطلبات النشطة",
      totalSpent: "إجمالي المدفوع",
      ordersUnavailable: "الطلبات غير متاحة",
      tryAgain: "حاول مرة أخرى",
      noOrdersTitle: "لا توجد طلبات بعد",
      noOrdersDescription:
        "عند إنشاء طلب، سيظهر هنا مع حالته وحالة الدفع وتفاصيل المنتجات.",
      browseProducts: "تصفح المنتجات",
      refresh: "تحديث",
      loadMore: "عرض طلبات أكثر",
      loadingMore: "جار التحميل…",
      order: "الطلب",
      placed: "تم الإنشاء",
      total: "المجموع",
      payment: "الدفع",
      items: "المنتجات",
      quantity: "الكمية",
      subtotal: "المجموع الفرعي",
      noImage: "لا توجد صورة",
      deliveryDetails: "تفاصيل التوصيل",
      deliveryArea: "منطقة التوصيل",
      deliveryCity: "المدينة أو المنطقة",
      deliveryAddress: "عنوان التوصيل",
      deliveryNotes: "ملاحظات التوصيل",
      deliveryPrice: "سعر التوصيل",
      pickupAgreement: "موافقة الاستلام",
      yes: "نعم",
      notProvided: "غير متوفر",
      notRequired: "غير مطلوب",
      failedToLoad: "فشل تحميل الطلبات.",
      failedToConnect: "فشل الاتصال بالخادم.",
      statuses: {
        PENDING: "قيد الانتظار",
        PROCESSING: "قيد المعالجة",
        SHIPPED: "تم الشحن",
        DELIVERED: "تم التسليم",
        CANCELLED: "ملغي",
      },
      paymentMethods: {
        CASH_ON_DELIVERY: "الدفع عند الاستلام",
      },
      paymentStatuses: {
        UNPAID: "غير مدفوع",
        PAID: "مدفوع",
      },
    },
    auth: {
      welcomeBackBadge: "مرحباً بعودتك",
      loginHeroTitle: "سجل الدخول وتابع التسوق.",
      loginHeroDescription: `ادخل إلى السلة والدفع وسجل الطلبات باستخدام حسابك في ${arabicStoreName}.`,
      loginTitle: "تسجيل الدخول",
      loginDescription: "أدخل البريد الإلكتروني وكلمة المرور للوصول إلى حسابك.",
      email: "البريد الإلكتروني",
      password: "كلمة المرور",
      name: "الاسم",
      phone: "رقم الهاتف",
      phoneHelp: "قد يستخدم المسؤول هذا الرقم لتأكيد طلبك.",
      nameInvalid: "أدخل الاسم من 2 إلى 50 حرفاً.",
      emailInvalid: "أدخل بريداً إلكترونياً صحيحاً.",
      phoneInvalid:
        "أدخل رقم هاتف صحيحاً باستخدام الأرقام والمسافات والشرطات والأقواس، ويمكن استخدام + في البداية فقط.",
      passwordRequired: "أدخل كلمة المرور.",
      passwordTooShort: "يجب أن تكون كلمة المرور 8 أحرف على الأقل.",
      fixHighlightedFields: "يرجى تصحيح الحقول المحددة.",
      invalidRegistrationInput:
        "بعض بيانات التسجيل غير صحيحة. يرجى مراجعة الحقول المحددة.",
      login: "تسجيل الدخول",
      loggingIn: "جار تسجيل الدخول...",
      continueWithGoogle: "المتابعة باستخدام Google",
      continuingWithGoogle: "جار فتح Google...",
      orContinueWithEmail: "أو تابع بالبريد الإلكتروني",
      googleSignInFailed:
        "فشل بدء تسجيل الدخول باستخدام Google. حاول مرة أخرى.",
      invalidLogin: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
      noAccount: "ليس لديك حساب؟",
      createOne: "أنشئ حساباً",
      registerBadge: `انضم إلى ${arabicStoreName}`,
      registerHeroTitle: "أنشئ حساباً قبل الدفع.",
      registerHeroDescription:
        "حسابك يساعدك على حفظ السلة، إنشاء الطلبات، ومتابعة سجل الطلبات.",
      registerTitle: "إنشاء حساب",
      registerDescription: "أنشئ حسابك كعميل.",
      createAccount: "إنشاء حساب",
      creatingAccount: "جار إنشاء الحساب...",
      alreadyHaveAccount: "لديك حساب بالفعل؟",
      passwordPlaceholder: "على الأقل 8 أحرف",
      passwordHelp:
        "استخدم كلمة مرور قوية. يجب أن يتم تشفيرها في الخادم قبل الحفظ.",
      registerSuccess: "تم إنشاء الحساب بنجاح. جار التحويل إلى تسجيل الدخول...",
      registerVerifyEmailSuccess:
        "تم إنشاء الحساب. يرجى فحص بريدك الإلكتروني لتأكيد الحساب.",
      failedToRegister: "فشل إنشاء الحساب.",
      failedToConnect: "فشل الاتصال بالخادم.",
      signOut: "تسجيل الخروج",
      signingOut: "جار تسجيل الخروج...",
      forgotPassword: "نسيت كلمة المرور؟",
      forgotPasswordBadge: "استعادة الحساب",
      forgotPasswordHeroTitle: "أعد تعيين كلمة المرور بأمان.",
      forgotPasswordHeroDescription:
        "أدخل بريد حسابك وسنرسل لك رابط إعادة التعيين. أثناء التطوير، سيظهر الرابط في التيرمنال لأن SMTP غير مفعّل بعد.",
      forgotPasswordTitle: "نسيت كلمة المرور؟",
      forgotPasswordDescription:
        "أدخل بريدك الإلكتروني وتحقق من صندوق الوارد للحصول على رابط إعادة التعيين.",
      sendResetLink: "إرسال رابط إعادة التعيين",
      sendingResetLink: "جاري إرسال الرابط...",
      resetRequestSuccess:
        "إذا كان هناك حساب بهذا البريد، فسيتم إرسال رابط إعادة تعيين كلمة المرور.",
      resetRequestFailed: "فشل طلب إعادة تعيين كلمة المرور. حاول مرة أخرى.",
      rememberPassword: "تذكرت كلمة المرور؟",
      backToLogin: "العودة لتسجيل الدخول",
      setNewPasswordBadge: "تعيين كلمة مرور جديدة",
      setNewPasswordHeroTitle: "اختر كلمة مرور جديدة وآمنة.",
      setNewPasswordHeroDescription:
        "استخدم 8 أحرف على الأقل. بعد إعادة التعيين، يتم إلغاء الجلسات القديمة من إعدادات المصادقة.",
      resetPasswordTitle: "إعادة تعيين كلمة المرور",
      resetPasswordDescription: "أدخل كلمة المرور الجديدة بالأسفل.",
      newPassword: "كلمة المرور الجديدة",
      confirmPassword: "تأكيد كلمة المرور",
      repeatPassword: "أعد كتابة كلمة المرور",
      resetPassword: "إعادة تعيين كلمة المرور",
      resettingPassword: "جاري إعادة التعيين...",
      resetMissingToken: "رابط إعادة التعيين لا يحتوي على الرمز المطلوب.",
      resetPasswordTooShort: "يجب أن تكون كلمة المرور 8 أحرف على الأقل.",
      passwordsDoNotMatch: "كلمتا المرور غير متطابقتين.",
      resetPasswordFailed: "فشل إعادة تعيين كلمة المرور.",
      resetPasswordSuccess:
        "تمت إعادة تعيين كلمة المرور بنجاح. سيتم تحويلك لتسجيل الدخول...",
      invalidResetLink:
        "رابط إعادة التعيين غير صالح أو منتهي الصلاحية. اطلب رابطاً جديداً.",
      requestNewResetLink: "طلب رابط جديد",
      loadingResetForm: "جاري تحميل نموذج إعادة التعيين...",
    },
    account: {
      badge: "الحساب",
      title: "حسابي",
      description: "اعرض تفاصيل حسابك والروابط السريعة.",
      quickActions: "إجراءات سريعة",
      browseProducts: "تصفح المنتجات",
      browseProductsDescription: "تابع التسوق وأضف منتجات إلى السلة.",
      viewCart: "عرض السلة",
      viewCartDescription: "راجع المنتجات قبل إنشاء الطلب.",
      myOrders: "طلباتي",
      myOrdersDescription: "تابع حالة الطلب وحالة الدفع.",
      adminDashboard: "لوحة الإدارة",
      adminDashboardDescription: "إدارة المنتجات والطلبات وبيانات المتجر.",
      noEmail: "لا يوجد بريد إلكتروني",
      customer: "عميل",
      accountSetupRequired: "يجب إكمال إعداد الحساب قبل إتمام الطلب",
      accountSetupDescription:
        "يمكنك تصفح المنتجات وإدارة حسابك، لكن إتمام الطلب يحتاج إلى بريد مؤكد ورقم هاتف حتى يتمكن مسؤول المتجر من تأكيد الطلب.",
      emailVerification: "تأكيد البريد الإلكتروني",
      verified: "مؤكد",
      notVerified: "غير مؤكد",
      phoneNumber: "رقم الهاتف",
      added: "مضاف",
      missing: "غير مضاف",
      updateProfile: "تحديث الملف الشخصي",
      updateProfileDescription: "أضف أو حدّث رقم هاتفك قبل إتمام الطلب.",
      sendingVerificationEmail: "جاري إرسال رسالة التحقق...",
      resendVerificationEmail: "إعادة إرسال رسالة التحقق",
      failedToSendVerificationEmail: "فشل إرسال رسالة التحقق.",
      verificationEmailSent:
        "تم إرسال رسالة التحقق. تحقق من بريدك، أو من التيرمنال أثناء التطوير.",
      emailStatus: "حالة البريد الإلكتروني",
      phone: "الهاتف",
      notAdded: "غير مضاف",
    },
    profile: {
      badge: "الملف الشخصي",
      title: "تحديث الملف الشخصي",
      description:
        "يستخدم مسؤول المتجر رقم هاتفك لتأكيد طلبات الدفع عند الاستلام.",
      emailStatus: "حالة البريد الإلكتروني",
      verified: "مؤكد",
      notVerified: "غير مؤكد",
      emailChangeHelp:
        "تغيير البريد الإلكتروني سيضاف لاحقاً لأنه يحتاج إلى خطوة تحقق منفصلة.",
      name: "الاسم",
      phoneNumber: "رقم الهاتف",
      phoneHelp:
        "رقم الهاتف مطلوب قبل إتمام الطلب. لم يتم تفعيله عبر SMS حالياً.",
      nameInvalid: "أدخل الاسم من 2 إلى 50 حرفاً.",
      phoneInvalid:
        "أدخل رقم هاتف صحيحاً باستخدام الأرقام والمسافات والشرطات والأقواس، ويمكن استخدام + في البداية فقط.",
      fixHighlightedFields: "يرجى تصحيح الحقول المحددة.",
      saveProfile: "حفظ الملف الشخصي",
      saving: "جاري الحفظ...",
      backToAccount: "العودة للحساب",
      failedToUpdate: "فشل تحديث الملف الشخصي.",
      updatedSuccessfully: "تم تحديث الملف الشخصي بنجاح.",
      failedToConnect: "فشل الاتصال بالخادم.",
    },
    legal: arabicLegal,

    admin: {
      dashboard: {
        badge: "الإدارة",
        title: "لوحة إدارة المتجر",
        description:
          "إدارة المنتجات والطلبات والمخزون وحالة الدفع وطلبات العملاء.",
        productsTitle: "المنتجات",
        productsBadge: "الكتالوج",
        productsDescription:
          "إنشاء المنتجات وتعديلها وأرشفتها واستعادتها وإدارة المخزون.",
        ordersTitle: "الطلبات",
        ordersBadge: "المبيعات",
        ordersDescription:
          "مراجعة طلبات العملاء وتحديث حالة الطلب والدفع والملاحظات الداخلية.",
        categoriesTitle: "التصنيفات",
        categoriesBadge: "الكتالوج",
        categoriesDescription:
          "إنشاء التصنيفات وتعديلها وحذفها بأمان عندما لا تكون مرتبطة بمنتجات.",
      },
      categories: {
        badge: "الإدارة",
        title: "التصنيفات",
        description:
          "إدارة تصنيفات المنتجات. يتم منع الحذف عندما تكون هناك منتجات مرتبطة بالتصنيف.",
        backToDashboard: "العودة إلى لوحة الإدارة",
        createTitle: "إنشاء تصنيف",
        createDescription:
          "أضف تصنيفاً جديداً للمنتجات. استخدم رابطاً مختصراً بحروف إنجليزية صغيرة للفلاتر والروابط.",
        name: "الاسم",
        namePlaceholder: "قمصان",
        slug: "الرابط المختصر",
        slugPlaceholder: "tops",
        make: "إنشاء",
        createButton: "إنشاء التصنيف",
        creating: "جار الإنشاء...",
        editTitle: "تعديل التصنيف",
        editDescription:
          "التغييرات تؤثر على فلاتر المنتجات والتصفح لاحقاً، ولا تغير لقطات الطلبات السابقة.",
        saveButton: "حفظ التصنيف",
        saving: "جار الحفظ...",
        cancel: "إلغاء",
        listTitle: "قائمة التصنيفات",
        listDescription:
          "لا يمكن حذف التصنيفات المرتبطة بمنتجات. انقل المنتجات أو أرشفها أولاً.",
        refresh: "تحديث",
        search: "بحث",
        searchPlaceholder: "ابحث باسم التصنيف أو الرابط المختصر...",
        usageFilter: "الاستخدام",
        allUsage: "كل التصنيفات",
        withProducts: "مرتبطة بمنتجات",
        emptyCategories: "تصنيفات فارغة",
        sortBy: "ترتيب حسب",
        sortNameAsc: "الاسم أ-ي",
        sortNameDesc: "الاسم ي-أ",
        sortNewest: "الأحدث أولاً",
        sortOldest: "الأقدم أولاً",
        applyFilters: "تطبيق الفلاتر",
        clearFilters: "مسح الفلاتر",
        pageInfo: "صفحة {page} من {totalPages}",
        previousPage: "السابق",
        nextPage: "التالي",
        totalCategories: "{count} تصنيف",
        noCategoriesYet: "لا توجد تصنيفات بعد.",
        productCount: "{count} منتجات مرتبطة",
        deleteBlockedHint: "الحذف ممنوع لأن هناك منتجات تستخدم هذا التصنيف.",
        edit: "تعديل",
        delete: "حذف",
        deleting: "جار الحذف...",
        deleteConfirm: "هل تريد حذف هذا التصنيف؟ لا يمكن التراجع عن ذلك.",
        cannotDeleteWithProducts:
          "لا يمكن حذف هذا التصنيف بينما توجد منتجات مرتبطة به.",
        failedToLoad: "فشل تحميل التصنيفات.",
        failedToConnect: "فشل الاتصال بالخادم.",
        failedToCreate: "فشل إنشاء التصنيف.",
        created: "تم إنشاء التصنيف بنجاح.",
        failedToUpdate: "فشل تحديث التصنيف.",
        updated: "تم تحديث التصنيف بنجاح.",
        failedToDelete: "فشل حذف التصنيف.",
        deleted: "تم حذف التصنيف بنجاح.",
      },
      orders: {
        badge: "الإدارة",
        title: "الطلبات",
        description:
          "راجع الطلبات، حدث حالة الشحن، علم المدفوعات، واحفظ ملاحظات خاصة بالإدارة.",
        dashboard: "لوحة الإدارة",
        refresh: "تحديث",
        search: "بحث",
        searchPlaceholder:
          "ابحث برقم الطلب أو العميل أو الهاتف أو البريد أو المدينة...",
        statusFilter: "الحالة",
        allStatuses: "كل الحالات",
        paymentFilter: "الدفع",
        allPaymentStatuses: "كل حالات الدفع",
        applyFilters: "تطبيق",
        clearFilters: "مسح",
        orderCards: "بطاقات الطلبات",
        pageInfo: "صفحة {page} من {totalPages}",
        previousPage: "السابق",
        nextPage: "التالي",
        currentPageOnly: "الصفحة الحالية فقط",
        totalOrders: "إجمالي الطلبات",
        pendingOrders: "الطلبات قيد الانتظار",
        revenueExcludingCancelled: "الإيراد بدون الطلبات الملغية",
        unpaidNotice: "يوجد {count} طلب{plural} ما زال غير مدفوع.",
        order: "الطلب",
        placed: "تم الإنشاء",
        customer: "العميل",
        unnamedCustomer: "عميل بدون اسم",
        total: "المجموع",
        orderStatus: "حالة الطلب",
        confirmOrder: "تأكيد الطلب",
        confirmingOrder: "جار التأكيد...",
        confirmOrderHelp:
          "أكد الطلب فقط بعد التواصل مع العميل. سيؤدي هذا إلى خصم المخزون ونقل الطلب إلى قيد المعالجة.",
        paymentStatus: "حالة الدفع",
        orderActions: "إجراءات الطلب",
        markPaid: "تعليم كمدفوع",
        items: "المنتجات",
        contactDetails: "بيانات التواصل",
        customerName: "اسم العميل",
        customerEmail: "بريد العميل",
        customerPhone: "هاتف العميل",
        deliveryDetails: "تفاصيل التوصيل",
        deliveryArea: "منطقة التوصيل",
        deliveryCity: "المدينة أو المنطقة",
        deliveryAddress: "عنوان التوصيل",
        deliveryNotes: "ملاحظات التوصيل",
        deliveryPrice: "سعر التوصيل",
        pickupAgreement: "موافقة الاستلام",
        yes: "نعم",
        notProvided: "غير متوفر",
        notRequired: "غير مطلوب",
        adminNote: "ملاحظة الإدارة",
        adminNotePlaceholder: "ملاحظة خاصة بالإدارة فقط...",
        saveNote: "حفظ الملاحظة",
        saving: "جار الحفظ...",
        noteWarning:
          "هذه الملاحظة للإدارة فقط. لا تحفظ كلمات مرور أو بيانات بطاقات دفع أو أسرار خاصة هنا.",
        noImage: "لا توجد صورة",
        noOrdersTitle: "لا توجد طلبات بعد",
        noOrdersDescription:
          "ستظهر طلبات العملاء هنا بعد إنشاء الطلب أو عند مطابقة الفلاتر لطلبات موجودة.",
        selectOrderTitle: "اختر طلباً",
        selectOrderDescription:
          "اختر بطاقة طلب لمراجعة التفاصيل وتعديل حالته من الإدارة.",
        unavailableTitle: "طلبات الإدارة غير متاحة",
        tryAgain: "حاول مرة أخرى",
        failedToLoad: "فشل تحميل طلبات الإدارة.",
        failedToLoadDetails: "فشل تحميل تفاصيل الطلب.",
        failedToConnect: "فشل الاتصال بالخادم.",
        failedToUpdateStatus: "فشل تحديث حالة الطلب.",
        failedToUpdatePayment: "فشل تحديث حالة الدفع.",
        failedToSaveNote: "فشل حفظ ملاحظة الإدارة.",
        statuses: {
          PENDING: "قيد الانتظار",
          PROCESSING: "قيد المعالجة",
          SHIPPED: "تم الشحن",
          DELIVERED: "تم التسليم",
          CANCELLED: "ملغي",
        },
        paymentStatuses: {
          UNPAID: "غير مدفوع",
          PAID: "مدفوع",
        },
      },
      products: {
        badge: "الإدارة",
        title: "المنتجات",
        description:
          "إدارة إنشاء المنتجات وتعديلها والمخزون وحالة الأرشفة والتصنيفات والصور.",
        backToDashboard: "العودة إلى لوحة الإدارة",
        activeProducts: "المنتجات النشطة",
        archivedProducts: "المنتجات المؤرشفة",
        categories: "التصنيفات",
        createProduct: "إنشاء منتج",
        createProductDescription:
          "أبقِ هذا النموذج مغلقاً أثناء تحديث المخزون اليومي. افتحه فقط عند إضافة قطعة ملابس جديدة.",
        addProduct: "إضافة منتج",
        hideCreateProduct: "إخفاء النموذج",
        manageCategories: "إدارة التصنيفات",
        productName: "اسم المنتج",
        productNamePlaceholder: "تيشيرت قطني كلاسيكي",
        slug: "الرابط المختصر",
        slugPlaceholder: "classic-cotton-t-shirt",
        make: "إنشاء",
        descriptionLabel: "الوصف",
        descriptionPlaceholder: "اكتب وصفاً واضحاً يظهر للعميل.",
        price: "السعر",
        discountPrice: "سعر الخصم",
        discountPricePlaceholder: "سعر تخفيض اختياري",
        discountPriceHelp:
          "اتركه فارغاً بدون خصم. يجب أن يكون أقل من السعر الأساسي.",
        stock: "المخزون",
        stockHelp:
          "أدر المخزون من الخيارات بعد حفظ المنتج. يستطيع العميل طلب الخيارات النشطة التي تحتوي على مخزون فقط.",
        optionsTitle: "الخيارات",
        optionsDescription:
          "أدر المقاسات والألوان والمخزون وحالة التفعيل. يستطيع العميل طلب الخيارات النشطة التي تحتوي على مخزون فقط.",
        optionCount: "{count} خيار",
        optionsCountLabel: "الخيارات",
        optionsCountHelp:
          "كل خيار يمثل اختياراً يظهر للعميل مثل المقاس أو اللون أو الاثنين معاً.",
        activeOptionStock: "مخزون الخيارات النشطة",
        activeOptionStockHelp:
          "هذا هو مجموع المخزون الذي يظهر للعميل عند تفعيل إظهار رقم المخزون.",
        size: "المقاس",
        color: "اللون",
        sortOrder: "ترتيب العرض",
        active: "نشط",
        saveOption: "حفظ الخيار",
        savingOption: "جار الحفظ...",
        makeInactive: "جعله غير نشط",
        makingInactive: "جار الحفظ...",
        addOption: "إضافة خيار",
        addingOption: "جار الإضافة...",
        sizePlaceholder: "المقاس، مثال M",
        colorPlaceholder: "اللون، مثال أسود",
        failedToCreateOption: "فشل إنشاء الخيار.",
        optionCreated: "تم إنشاء الخيار بنجاح.",
        failedToUpdateOption: "فشل تحديث الخيار.",
        optionUpdated: "تم تحديث الخيار بنجاح.",
        failedToDeactivateOption: "فشل جعل الخيار غير نشط.",
        optionDeactivated: "أصبح الخيار غير نشط.",
        category: "التصنيف",
        selectCategory: "اختر التصنيف",
        featuredProduct: "منتج مميز",
        showStockOnStore: "إظهار عدد المخزون للعملاء",
        showStockHelp:
          "عند إيقافه يرى العميل توفر المنتج بدون الرقم الدقيق. يبقى المخزون ظاهراً للإدارة هنا.",
        stockHidden: "المخزون مخفي",
        images: "الصور",
        imageUrlPlaceholder: "https://...",
        addUrl: "إضافة رابط",
        imageHelp:
          "JPG أو PNG أو WEBP. الحد الأقصى 10MB. يتم تحسين الصور عبر Cloudinary بعد الرفع.",
        imageTooLarge:
          "الصورة كبيرة جداً. يرجى رفع صورة JPG أو PNG أو WEBP بحجم لا يتجاوز {size}MB.",
        checkHighlightedFields: "راجع الحقول المحددة.",
        invalidProductName: "أدخل اسم المنتج.",
        invalidProductSlug:
          "استخدم أحرفاً إنجليزية صغيرة وأرقاماً وشرطات فقط. مثال: classic-shirt.",
        productSlugAlreadyUsed: "رابط هذا المنتج مستخدم بالفعل.",
        invalidDescription: "الوصف طويل جداً.",
        invalidPrice: "أدخل سعراً صحيحاً.",
        invalidDiscountPrice: "يجب أن يكون سعر الخصم أقل من السعر الأساسي.",
        invalidCategory: "اختر تصنيفاً.",
        invalidImage:
          "ارفع صورة JPG أو PNG أو WEBP صالحة بحجم لا يزيد عن 10MB.",
        invalidOptionSizeOrColor: "أدخل المقاس أو اللون على الأقل.",
        invalidOptionStock: "أدخل رقم مخزون صحيحاً بدون كسور.",
        invalidOptionSortOrder: "أدخل رقم ترتيب صحيحاً بدون كسور.",
        productPreview: "معاينة المنتج",
        remove: "حذف",
        createProductButton: "إنشاء المنتج",
        creating: "جار الإنشاء...",
        editProduct: "تعديل المنتج",
        editProductDescription:
          "أنت تعدل منتجاً موجوداً. التغييرات تؤثر على المتسوقين لاحقاً، ولا تغير بيانات الطلبات السابقة.",
        cancel: "إلغاء",
        saveProduct: "حفظ المنتج",
        saving: "جار الحفظ...",
        newCategory: "تصنيف جديد",
        categoryName: "الاسم",
        categoryNamePlaceholder: "قمصان",
        categorySlug: "الرابط المختصر",
        categorySlugPlaceholder: "tops",
        createCategory: "إنشاء التصنيف",
        creatingCategory: "جار الإنشاء...",
        categoryList: "قائمة التصنيفات",
        noCategoriesYet: "لا توجد تصنيفات بعد.",
        productList: "قائمة المنتجات",
        productListDescription:
          "الأرشفة تخفي المنتج من التصفح العام بدون حذف سجل الطلبات السابقة.",
        refresh: "تحديث",
        search: "بحث",
        searchPlaceholder: "ابحث باسم المنتج أو الرابط أو الوصف...",
        categoryFilter: "التصنيف",
        allCategories: "كل التصنيفات",
        statusFilter: "الحالة",
        allStatuses: "كل الحالات",
        activeStatus: "نشط",
        archivedStatus: "مؤرشف",
        stockFilter: "المخزون",
        allStock: "كل المخزون",
        inStock: "متوفر",
        outOfStock: "نفذ المخزون",
        lowStock: "مخزون منخفض",
        sortBy: "ترتيب حسب",
        sortNewest: "الأحدث أولاً",
        sortOldest: "الأقدم أولاً",
        sortNameAsc: "الاسم أ-ي",
        sortNameDesc: "الاسم ي-أ",
        sortPriceAsc: "السعر من الأقل للأعلى",
        sortPriceDesc: "السعر من الأعلى للأقل",
        sortStockAsc: "المخزون من الأقل للأعلى",
        sortStockDesc: "المخزون من الأعلى للأقل",
        applyFilters: "تطبيق الفلاتر",
        clearFilters: "مسح الفلاتر",
        pageInfo: "صفحة {page} من {totalPages}",
        previousPage: "السابق",
        nextPage: "التالي",
        totalProducts: "{count} منتج",
        noProductsYet: "لا توجد منتجات بعد.",
        noImage: "لا توجد صورة",
        featured: "مميز",
        archived: "مؤرشف",
        edit: "تعديل",
        archive: "أرشفة",
        archiving: "جار الأرشفة...",
        restore: "استعادة",
        restoring: "جار الاستعادة...",
        updateStock: "تحديث المخزون",
        stockSaving: "جار الحفظ...",
        failedToLoadProducts: "فشل تحميل المنتجات.",
        failedToLoadCategories: "فشل تحميل التصنيفات.",
        failedToConnect: "فشل الاتصال بالخادم.",
        failedToUploadImage: "فشل رفع صورة المنتج.",
        imageUploaded: "تم رفع الصورة بنجاح.",
        failedToCreateProduct: "فشل إنشاء المنتج.",
        productCreated: "تم إنشاء المنتج بنجاح.",
        failedToUpdateProduct: "فشل تحديث المنتج.",
        productUpdated: "تم تحديث المنتج بنجاح.",
        failedToArchiveProduct: "فشل أرشفة المنتج.",
        productArchived: "تمت أرشفة المنتج بنجاح.",
        failedToRestoreProduct: "فشل استعادة المنتج.",
        productRestored: "تمت استعادة المنتج بنجاح.",
        failedToUpdateStock: "فشل تحديث المخزون.",
        stockUpdated: "تم تحديث المخزون بنجاح.",
        failedToCreateCategory: "فشل إنشاء التصنيف.",
        categoryCreated: "تم إنشاء التصنيف بنجاح.",
      },
    },
  },
};
