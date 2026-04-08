window.LELESHAN_DEFAULTS = {
  stapleOptions: [
    { id: "rice-free", name: "白飯", price: 0 },
    { id: "instant-noodles-free", name: "王子麵", price: 0 },
    { id: "glass-noodles-free", name: "冬粉", price: 0 },
    { id: "udon-plus", name: "烏龍麵", price: 15 },
    { id: "dumpling-6-plus", name: "水餃 6 顆", price: 25 },
    { id: "braised-rice-plus", name: "滷肉飯", price: 20 }
  ],
  flavors: [
    { id: "red-oil", name: "紅油麻辣", description: "香麻帶勁的經典風味", spicyLabel: "辣度可調整", sort: 10, enabled: true },
    { id: "green-pepper", name: "青花椒麻", description: "麻香突出、尾韻清爽", spicyLabel: "偏麻不死辣", sort: 20, enabled: true },
    { id: "broth-spicy", name: "麻辣湯底", description: "適合想喝湯的麻辣口味", spicyLabel: "中辣以上推薦", sort: 30, enabled: true },
    { id: "fresh-broth", name: "清湯", description: "不吃辣也可以選擇", spicyLabel: "不辣", sort: 40, enabled: true },
    { id: "dry-mix", name: "乾拌", description: "拌勻後更能吃到醬香", spicyLabel: "可做不辣或微辣", sort: 50, enabled: true }
  ],
  categories: [
    { id: "meat", name: "肉品", enabled: true, sort: 10 },
    { id: "vegetables", name: "蔬菜", enabled: true, sort: 20 },
    { id: "hotpot-a", name: "火鍋料 A", enabled: true, sort: 30 },
    { id: "hotpot-b", name: "火鍋料 B", enabled: true, sort: 40 },
    { id: "special", name: "特色加點", enabled: true, sort: 50 },
    { id: "staples", name: "主食", enabled: true, sort: 60 }
  ],
  menuItems: [
    { id: "pork-classic", name: "經典豬肉片", price: 45, categoryId: "meat", enabled: true, sort: 10, description: "", tags: [], optionGroups: [], unit: "" },
    { id: "chicken-sliced", name: "薄切雞肉片", price: 55, categoryId: "meat", enabled: true, sort: 20, description: "", tags: [], optionGroups: [], unit: "" },
    { id: "pork-plum", name: "梅花豬肉片", price: 55, categoryId: "meat", enabled: true, sort: 30, description: "", tags: [], optionGroups: [], unit: "" },
    { id: "beef-sliced", name: "鮮切牛五花", price: 65, categoryId: "meat", enabled: true, sort: 40, description: "", tags: [], optionGroups: [], unit: "" },
    { id: "potato", name: "馬鈴薯", price: 25, categoryId: "vegetables", enabled: true, sort: 10, description: "", tags: [], optionGroups: [], unit: "" },
    { id: "corn", name: "玉米", price: 30, categoryId: "vegetables", enabled: true, sort: 20, description: "", tags: [], optionGroups: [], unit: "" },
    { id: "lotus-root", name: "蓮藕", price: 30, categoryId: "vegetables", enabled: true, sort: 30, description: "", tags: [], optionGroups: [], unit: "" },
    { id: "cauliflower", name: "青花菜", price: 25, categoryId: "vegetables", enabled: true, sort: 40, description: "", tags: [], optionGroups: [], unit: "" },
    { id: "baby-cabbage", name: "娃娃菜", price: 30, categoryId: "vegetables", enabled: true, sort: 50, description: "", tags: [], optionGroups: [], unit: "" },
    { id: "stuffed-cabbage", name: "高麗菜捲", price: 25, categoryId: "vegetables", enabled: true, sort: 60, description: "", tags: [], optionGroups: [], unit: "" },
    { id: "enoki", name: "金針菇", price: 25, categoryId: "vegetables", enabled: true, sort: 70, description: "", tags: [], optionGroups: [], unit: "" },
    { id: "okra", name: "秋葵", price: 25, categoryId: "vegetables", enabled: true, sort: 80, description: "", tags: [], optionGroups: [], unit: "" },
    { id: "sausage", name: "鑫鑫腸", price: 30, categoryId: "hotpot-a", enabled: true, sort: 10, description: "", tags: [], optionGroups: [], unit: "6 顆" },
    { id: "crab-stick", name: "蟹肉棒", price: 25, categoryId: "hotpot-a", enabled: true, sort: 20, description: "", tags: [], optionGroups: [], unit: "3 支" },
    { id: "roe-ball", name: "魚卵福袋", price: 25, categoryId: "hotpot-a", enabled: true, sort: 30, description: "", tags: [], optionGroups: [], unit: "3 顆" },
    { id: "shrimp-dumpling", name: "蝦餃", price: 25, categoryId: "hotpot-a", enabled: true, sort: 40, description: "", tags: [], optionGroups: [], unit: "3 顆" },
    { id: "egg-dumpling", name: "蛋餃", price: 25, categoryId: "hotpot-a", enabled: true, sort: 50, description: "", tags: [], optionGroups: [], unit: "3 顆" },
    { id: "fish-tofu", name: "魚豆腐", price: 25, categoryId: "hotpot-a", enabled: true, sort: 60, description: "", tags: [], optionGroups: [], unit: "3 塊" },
    { id: "rice-blood", name: "米血", price: 10, categoryId: "hotpot-a", enabled: true, sort: 70, description: "", tags: [], optionGroups: [], unit: "" },
    { id: "black-ring-small", name: "甜不辣小黑輪", price: 20, categoryId: "hotpot-a", enabled: true, sort: 80, description: "", tags: [], optionGroups: [], unit: "4 塊" },
    { id: "black-ring-large", name: "大黑輪", price: 20, categoryId: "hotpot-a", enabled: true, sort: 90, description: "", tags: [], optionGroups: [], unit: "1 片" },
    { id: "bean-roll", name: "豆皮", price: 25, categoryId: "hotpot-a", enabled: true, sort: 100, description: "", tags: [], optionGroups: [], unit: "" },
    { id: "frozen-tofu", name: "凍豆腐", price: 25, categoryId: "hotpot-a", enabled: true, sort: 110, description: "", tags: [], optionGroups: [], unit: "4 塊" },
    { id: "beef-ball", name: "牛肉丸", price: 15, categoryId: "hotpot-b", enabled: true, sort: 10, description: "", tags: [], optionGroups: [], unit: "1 顆" },
    { id: "cheese-beef-ball", name: "起司牛肉丸", price: 15, categoryId: "hotpot-b", enabled: true, sort: 20, description: "", tags: [], optionGroups: [], unit: "1 顆" },
    { id: "gongwan", name: "貢丸", price: 25, categoryId: "hotpot-b", enabled: true, sort: 30, description: "", tags: [], optionGroups: [], unit: "4 顆" },
    { id: "cabbage-roll", name: "高麗菜捲", price: 45, categoryId: "hotpot-b", enabled: true, sort: 40, description: "", tags: [], optionGroups: [], unit: "2 捲" },
    { id: "duck-intestine", name: "鴨腸", price: 40, categoryId: "special", enabled: true, sort: 10, description: "", tags: [], optionGroups: [], unit: "" },
    { id: "tripe", name: "毛肚", price: 40, categoryId: "special", enabled: true, sort: 20, description: "", tags: [], optionGroups: [], unit: "" },
    { id: "white-shrimp", name: "白蝦", price: 50, categoryId: "special", enabled: true, sort: 30, description: "", tags: [], optionGroups: [], unit: "6 隻" },
    { id: "instant-noodles", name: "王子麵", price: 15, categoryId: "staples", enabled: true, sort: 10, description: "", tags: [], optionGroups: [], unit: "" },
    { id: "rice", name: "白飯", price: 15, categoryId: "staples", enabled: true, sort: 20, description: "", tags: [], optionGroups: [], unit: "" },
    { id: "glass-noodles", name: "冬粉", price: 15, categoryId: "staples", enabled: true, sort: 30, description: "", tags: [], optionGroups: [], unit: "" },
    { id: "udon", name: "烏龍麵", price: 30, categoryId: "staples", enabled: true, sort: 40, description: "", tags: [], optionGroups: [], unit: "" },
    { id: "korean-q-noodle", name: "韓式 Q 麵", price: 35, categoryId: "staples", enabled: true, sort: 50, description: "", tags: [], optionGroups: [], unit: "" },
    { id: "dumpling-piece", name: "單點水餃", price: 6, categoryId: "staples", enabled: true, sort: 60, description: "", tags: [], optionGroups: [], unit: "每顆" },
    { id: "braised-rice-small", name: "滷肉飯", price: 35, categoryId: "staples", enabled: true, sort: 70, description: "", tags: [], optionGroups: [], unit: "小" },
    { id: "braised-rice-large", name: "滷肉飯", price: 45, categoryId: "staples", enabled: true, sort: 80, description: "", tags: [], optionGroups: [], unit: "大" }
  ],
  comboTemplates: [
    {
      id: "combo-classic",
      name: "經典豬肉片",
      price: 130,
      enabled: true,
      sort: 10,
      description: "馬鈴薯、娃娃菜、豆皮、黑輪、凍豆腐、肉片等固定配料",
      tags: ["套餐"],
      optionGroups: [
        {
          id: "staple",
          name: "主食",
          type: "single",
          options: [
            { id: "rice-free", name: "白飯", price: 0 },
            { id: "instant-noodles-free", name: "王子麵", price: 0 },
            { id: "glass-noodles-free", name: "冬粉", price: 0 },
            { id: "udon-plus", name: "烏龍麵", price: 15 },
            { id: "dumpling-6-plus", name: "水餃 6 顆", price: 25 },
            { id: "braised-rice-plus", name: "滷肉飯", price: 20 }
          ]
        }
      ]
    },
    {
      id: "combo-triple-meat",
      name: "熱賣三倍肉",
      price: 165,
      enabled: true,
      sort: 20,
      description: "固定配料搭配加量肉片，份量更滿足",
      tags: ["套餐", "熱賣"],
      optionGroups: [
        {
          id: "staple",
          name: "主食",
          type: "single",
          options: [
            { id: "rice-free", name: "白飯", price: 0 },
            { id: "instant-noodles-free", name: "王子麵", price: 0 },
            { id: "glass-noodles-free", name: "冬粉", price: 0 },
            { id: "udon-plus", name: "烏龍麵", price: 15 },
            { id: "dumpling-6-plus", name: "水餃 6 顆", price: 25 },
            { id: "braised-rice-plus", name: "滷肉飯", price: 20 }
          ]
        }
      ]
    },
    {
      id: "combo-tripe-double-meat",
      name: "招牌毛肚雙倍肉",
      price: 180,
      enabled: true,
      sort: 30,
      description: "固定配料、毛肚與雙倍肉量組合",
      tags: ["套餐", "招牌"],
      optionGroups: [
        {
          id: "staple",
          name: "主食",
          type: "single",
          options: [
            { id: "rice-free", name: "白飯", price: 0 },
            { id: "instant-noodles-free", name: "王子麵", price: 0 },
            { id: "glass-noodles-free", name: "冬粉", price: 0 },
            { id: "udon-plus", name: "烏龍麵", price: 15 },
            { id: "dumpling-6-plus", name: "水餃 6 顆", price: 25 },
            { id: "braised-rice-plus", name: "滷肉飯", price: 20 }
          ]
        }
      ]
    },
    {
      id: "combo-mixed-hotpot",
      name: "綜合鍋物",
      price: 145,
      enabled: true,
      sort: 40,
      description: "多種火鍋料搭配肉片的綜合組合",
      tags: ["套餐"],
      optionGroups: [
        {
          id: "staple",
          name: "主食",
          type: "single",
          options: [
            { id: "rice-free", name: "白飯", price: 0 },
            { id: "instant-noodles-free", name: "王子麵", price: 0 },
            { id: "glass-noodles-free", name: "冬粉", price: 0 },
            { id: "udon-plus", name: "烏龍麵", price: 15 },
            { id: "dumpling-6-plus", name: "水餃 6 顆", price: 25 },
            { id: "braised-rice-plus", name: "滷肉飯", price: 20 }
          ]
        }
      ]
    }
  ],
  settings: {
    isOpen: true,
    openNotice: "",
    promoText: "滿 150 元送白飯 1 份",
    promoEnabled: true,
    openFrom: "17:40",
    openTo: "22:50"
  },
  promotions: [
    {
      id: "promo-free-rice",
      name: "滿 150 送白飯",
      type: "gift",
      condition: { minAmount: 150 },
      reward: { type: "free_item", itemId: "rice" },
      enabled: true
    }
  ]
};
