-- 0236: the trades and areas themselves.
--
-- Chosen for Lebanon, not translated from a global directory. The additions
-- that matter most here are the ones no imported taxonomy would carry:
-- مولّدات and اشتراك, طاقة شمسية, إنفرتر وبطاريات, مضخات وخزانات مياه,
-- ستلايت وإنترنت. In a country where power and water are private problems,
-- those are among the most-searched trades there are.
--
-- Deliberately dropped from the first draft: "صيانة عامة", "تفصيل وتركيب" and
-- "خدمات حرفية متخصصة". Nobody searches for a general maintenance man — those
-- are bins, and a bin category collects listings that then never get found.
--
-- `synonyms` is the load-bearing column. Every entry is a word a Lebanese
-- customer would actually type: كهربجي rather than كهربائي, عفش rather than
-- أثاث, بنشر, جبس, ونش, سولار, طرمبة, كوشوك. Search reads these, so a trade
-- can be found by its street name without the taxonomy adopting it.

insert into public.trade_groups (slug, name_ar, name_en, icon, sort_order) values
  ('home',       'صيانة البيت',      'Home repair',        '🏠', 1),
  ('cooling',    'تكييف وتبريد',      'Cooling',            '❄️', 2),
  ('appliances', 'صيانة الأجهزة',     'Appliances',         '🧺', 3),
  ('energy',     'كهربا ومي',        'Power & water',      '⚡', 4),
  ('auto',       'السيارات',          'Cars',               '🚗', 5),
  ('cleaning',   'تنظيف',            'Cleaning',           '🧹', 6),
  ('moving',     'نقل وتركيب',        'Moving & fitting',   '🚚', 7),
  ('outdoor',    'حدائق وخارجي',      'Garden & outdoor',   '🌳', 8),
  ('building',   'بناء وترميم',       'Building',           '🔨', 9)
on conflict (slug) do nothing;

insert into public.trades (slug, group_slug, name_ar, name_en, synonyms, icon, sort_order) values
  ('electrician','home','كهربائي','Electrician','{كهربجي,كهربا,كهرباء,تمديدات,انارة}','⚡',1),
  ('plumber','home','سبّاك','Plumber','{سباك,مواسرجي,تسريب,مي,مواسير,صحي}','🚰',2),
  ('carpenter','home','نجّار','Carpenter','{نجار,خشب,موبيليا,مطبخ,خزانة}','🪚',3),
  ('painter','home','دهّان','Painter','{دهان,بويا,صبغ,دهين}','🎨',4),
  ('tiler','home','مبلّط','Tiler','{بلاط,سيراميك,رخام,بورسلان}','🧱',5),
  ('plasterer','home','جبصين وديكور','Plaster & decor','{جبس,جبصين,ديكور,اسقف}','🪛',6),
  ('blacksmith','home','حدّاد','Blacksmith','{حداد,حديد,مظلة,درابزين}','🔩',7),
  ('aluminium','home','ألومينيوم','Aluminium','{المنيوم,قطع,واجهات}','🪟',8),
  ('glazier','home','زجاج','Glass','{زجاج,جام,قزاز,سيكوريت}','🔷',9),
  ('doors-windows','home','أبواب وشبابيك','Doors & windows','{باب,شباك,اقفال,مفاتيح}','🚪',10),
  ('waterproofing','home','عزل ورطوبة','Waterproofing','{عزل,رطوبة,تنشيف,تسرب}','💧',11),
  ('ac-install','cooling','تركيب مكيفات','AC installation','{مكيف,اسبليت,تركيب}','❄️',1),
  ('ac-service','cooling','صيانة مكيفات','AC service','{مكيف,صيانة,تنظيف,تعبئة,غاز}','🧰',2),
  ('fridge-repair','cooling','تصليح برادات','Fridge repair','{براد,ثلاجة,فريزر}','🧊',3),
  ('cold-rooms','cooling','غرف تبريد','Cold rooms','{تبريد,غرفة,شيلر}','🏭',4),
  ('washer-repair','appliances','غسالات ونشافات','Washers & dryers','{غسالة,نشافة,غسيل}','🧺',1),
  ('dishwasher-repair','appliances','جلايات','Dishwashers','{جلاية,جلي}','🍽️',2),
  ('oven-repair','appliances','أفران وغاز','Ovens & gas','{فرن,غاز,طباخ,بوتاجاز}','🔥',3),
  ('heater-repair','appliances','سخانات وشوفاج','Heaters','{سخان,شوفاج,تدفئة,مازوت}','🔆',4),
  ('appliance-general','appliances','أجهزة منزلية','Home appliances','{اجهزة,كهربائية,تصليح}','🔌',5),
  ('generator','energy','مولّدات','Generators','{مولد,موتور,اشتراك,مولدة}','🔋',1),
  ('solar','energy','طاقة شمسية','Solar','{سولار,شمسية,الواح,طاقة}','☀️',2),
  ('inverter','energy','إنفرتر وبطاريات','Inverter & batteries','{انفرتر,بطاريات,كهربا}','🔌',3),
  ('water-pump','energy','مضخات مياه','Water pumps','{مضخة,دينمو,مي,طرمبة}','💦',4),
  ('water-tank','energy','خزانات مياه','Water tanks','{خزان,تنك,مي}','🛢️',5),
  ('satellite-net','energy','ستلايت وإنترنت','Satellite & internet','{ستلايت,دش,انترنت,شبكة}','📡',6),
  ('mechanic','auto','ميكانيكي','Mechanic','{ميكانيك,محرك,موتور}','🔧',1),
  ('auto-electric','auto','كهربا سيارات','Auto electrics','{كهربا,سيارة,دينمو,سلف}','🔋',2),
  ('tyres','auto','دواليب وبناشر','Tyres','{دولاب,كوشوك,بنشر,اطار}','🛞',3),
  ('car-battery','auto','بطاريات سيارات','Car batteries','{بطارية,سيارة}','🔋',4),
  ('car-glass','auto','زجاج سيارات','Car glass','{زجاج,جام,سيارة,بلور}','🪟',5),
  ('car-wash','auto','غسيل وتلميع','Wash & polish','{غسيل,تلميع,بوليش}','🧽',6),
  ('towing','auto','سحب سيارات','Towing','{ونش,سحب,رافعة}','🚛',7),
  ('home-cleaning','cleaning','تنظيف بيوت','Home cleaning','{تنظيف,شغالة,بيت}','🧹',1),
  ('office-cleaning','cleaning','تنظيف مكاتب','Office cleaning','{تنظيف,مكتب,شركة}','🏢',2),
  ('post-construction','cleaning','تنظيف بعد البناء','After-build cleaning','{تنظيف,بناء,ورشة}','🚧',3),
  ('sofa-carpet','cleaning','تنظيف سجاد وكنب','Carpet & sofa','{سجاد,كنب,موكيت,شامبو}','🛋️',4),
  ('pest-control','cleaning','مكافحة حشرات','Pest control','{حشرات,رش,صراصير,فئران,نمل}','🐜',5),
  ('furniture-moving','moving','نقل أثاث','Furniture moving','{نقل,عفش,نقليات,شحن}','🚚',1),
  ('goods-transport','moving','نقل بضائع','Goods transport','{نقل,بضاعة,شاحنة,كاميون}','📦',2),
  ('furniture-assembly','moving','فك وتركيب أثاث','Assembly','{تركيب,فك,اثاث,موبيليا}','🪑',3),
  ('landscaping','outdoor','تنسيق حدائق','Landscaping','{حديقة,تنسيق,زراعة,عشب}','🌳',1),
  ('tree-cutting','outdoor','قص وتقليم أشجار','Tree cutting','{شجر,قص,تقليم}','🪓',2),
  ('irrigation','outdoor','ري وشبكات','Irrigation','{ري,شبكة,رشاشات}','💧',3),
  ('construction','building','أعمال بناء','Construction','{بناء,باطون,بلوك,ورشة}','🏗️',1),
  ('renovation','building','ترميم وتشطيب','Renovation','{ترميم,تشطيب,تجديد}','🧱',2),
  ('contracting','building','مقاولات','Contracting','{مقاول,مقاولات,اشراف}','📐',3)
on conflict (slug) do nothing;

-- Areas sit under the five regions the platform already uses; the regions
-- themselves are untouched.
insert into public.lb_areas (slug, region, name_ar, name_en, sort_order) values
  ('beirut-city','beirut','بيروت','Beirut',1),
  ('achrafieh','beirut','الأشرفية','Achrafieh',2),
  ('hamra','beirut','الحمرا','Hamra',3),
  ('mazraa','beirut','المزرعة','Mazraa',4),
  ('ras-beirut','beirut','رأس بيروت','Ras Beirut',5),
  ('badaro','beirut','بدارو','Badaro',6),
  ('tripoli','north','طرابلس','Tripoli',1),
  ('mina','north','الميناء','El Mina',2),
  ('abi-samra','north','أبي سمراء','Abi Samra',3),
  ('qalamoun','north','القلمون','Qalamoun',4),
  ('zgharta','north','زغرتا','Zgharta',5),
  ('koura','north','الكورة','Koura',6),
  ('batroun','north','البترون','Batroun',7),
  ('bcharre','north','بشري','Bcharre',8),
  ('akkar','north','عكار','Akkar',9),
  ('halba','north','حلبا','Halba',10),
  ('minieh','north','المنية','Minieh',11),
  ('dinnieh','north','الضنية','Dinnieh',12),
  ('jounieh','mountLebanon','جونية','Jounieh',1),
  ('zouk','mountLebanon','ذوق مصبح','Zouk Mosbeh',2),
  ('jbeil','mountLebanon','جبيل','Jbeil',3),
  ('baabda','mountLebanon','بعبدا','Baabda',4),
  ('aley','mountLebanon','عاليه','Aley',5),
  ('chouf','mountLebanon','الشوف','Chouf',6),
  ('metn','mountLebanon','المتن','Metn',7),
  ('brummana','mountLebanon','برمانا','Brummana',8),
  ('dbayeh','mountLebanon','ضبية','Dbayeh',9),
  ('antelias','mountLebanon','أنطلياس','Antelias',10),
  ('hazmieh','mountLebanon','الحازمية','Hazmieh',11),
  ('bikfaya','mountLebanon','بكفيا','Bikfaya',12),
  ('khalde','mountLebanon','خلدة','Khalde',13),
  ('saida','south','صيدا','Saida',1),
  ('tyre','south','صور','Tyre',2),
  ('nabatieh','south','النبطية','Nabatieh',3),
  ('jezzine','south','جزين','Jezzine',4),
  ('bint-jbeil','south','بنت جبيل','Bint Jbeil',5),
  ('marjeyoun','south','مرجعيون','Marjeyoun',6),
  ('zahrani','south','الزهراني','Zahrani',7),
  ('zahle','bekaa','زحلة','Zahle',1),
  ('baalbek','bekaa','بعلبك','Baalbek',2),
  ('chtaura','bekaa','شتورا','Chtaura',3),
  ('rayak','bekaa','رياق','Rayak',4),
  ('hermel','bekaa','الهرمل','Hermel',5),
  ('rachaya','bekaa','راشيا','Rachaya',6),
  ('west-bekaa','bekaa','البقاع الغربي','West Bekaa',7)
on conflict (slug) do nothing;
