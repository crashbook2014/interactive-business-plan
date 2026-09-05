const T = {
  /* ---- pre-launch copy. Every line here is written to do one job: make
     someone who has a contract problem right now pick up the phone. The
     product is described in the present tense because it exists and works —
     what is "soon" is the day they can open it themselves, not the thing. */
  soon_eyebrow:{ar:"قريبًا — وضوح يفتح أبوابه",en:"Launching soon"},
  soon_cta:{ar:"كلّمنا الحين",en:"Talk to us now"},
  soon_nav_cta:{ar:"تواصل",en:"Contact"},
  soon_note:{ar:"جاهز، ونراجعه مراجعة أخيرة قبل ما نفتحه للكل. إذا عندك عقد أو مشكلة الحين — لا تنتظر، كلّمنا.",
             en:"It's built, and getting its final review before we open it to everyone. If you have a contract or a problem right now, don't wait — talk to us."},
  soon_k_contact:{ar:"تواصل",en:"Get in touch"},
  soon_contact_h:{ar:"عندك سؤال، أو تبي تحجز مكانك؟",en:"Have a question, or want your place at launch?"},
  soon_contact_p:{ar:"نرد بأنفسنا، مو بردود جاهزة. اسأل عن حالتك، أو احجز سعر الافتتاح، أو خذ رأينا في عقد قدّامك اليوم.",
                  en:"You'll reach a person, not a form. Ask about your situation, lock in launch pricing, or get our read on a contract in front of you today."},
  soon_wa:{ar:"واتساب",en:"WhatsApp"},
  soon_call:{ar:"اتصل بنا",en:"Call us"},
  soon_mail:{ar:"راسلنا",en:"Email us"},
  soon_price_note:{ar:"هذي أسعار الافتتاح، وهي وش بندفعه إحنا كذلك أول ما نطلق.",
                   en:"These are the launch prices — the same ones we'll be paying ourselves when we open."},
  soon_price_cta:{ar:"احجز سعر الافتتاح",en:"Reserve launch pricing"},

  nav_cta:{ar:"جرّبه الآن",en:"Try it now"},
  nav_price:{ar:"الأسعار",en:"Pricing"},
  price_cta:{ar:"ابدأ بالتقييم المجاني",en:"Start with the free score"},
  foot_app:{ar:"افتح التطبيق",en:"Open the app"},
  foot_brand:{ar:"الهوية البصرية",en:"Brand identity"},
  /* THE PROMISE MATCHES THE APP, OR IT IS NOT A PROMISE.
     This page stated the absolute version of the privacy claim in four places
     — here, t1p, the FAQ and close_p — while the app itself switches to
     `privacy_line_ai` the moment the optional Claude read is live, because
     scanned contracts do get uploaded with consent. The page people read
     BEFORE handing over an employment contract cannot be the one place that
     overstates it. Same conditional truth, same wording as the app. */
  hero_eyebrow:{ar:"يعمل على جهازك — ما يُرفع عقدك إلا بموافقتك",en:"Runs on your device — nothing is uploaded without your consent"},
  hero_h:{ar:"اعرف هل تقدر توقّع — قبل ما توقّع.",en:"Know whether you can sign — before you do."},
  hero_p:{ar:"جواب واحد واضح: وقّع، أو فاوض، أو راجع محاميًا — ومعه البنود اللي وراء القرار، ومصدر كل معلومة من نظام العمل، وخطاب جاهز ترسله. تختار سعودي أو مقيم، ونعرض لك الأنظمة اللي تنطبق عليك أنت.",
          en:"One clear answer: sign, negotiate, or see a lawyer — with the clauses behind it, the labour-law source for every point, and a letter ready to send. Pick Saudi or resident, and we show the rules that actually apply to you."},
  hero_cta:{ar:"حلّل عقدًا مجانًا",en:"Analyze a contract free"},
  hero_cta2:{ar:"كيف يشتغل؟",en:"How it works"},
  /* "no sign-up" was removed here once analysing a contract needed an account;
     the exception carved out at the time — that the calculator genuinely
     needed none — has since gone too, because every screen now requires one.
     What is left is true and is the promise that matters: free is real, and it
     is one scan a month. A free account is named up front rather than
     discovered at the first tap. */
  hero_note:{ar:"التقييم والتنبيهات مجانية — فحص واحد كل شهر بحساب مجاني.",en:"The score and flags are free — one scan a month with a free account."},
  shot_verdict:{ar:"عقد عادل بشكل عام — فاوض على بندين قبل التوقيع.",en:"Mostly fair — negotiate two clauses before you sign."},
  shot_r1:{ar:"بند عدم المنافسة",en:"Non-compete clause"},
  shot_r2:{ar:"مدة الإشعار",en:"Notice period"},
  shot_r3:{ar:"الراتب والبدلات",en:"Salary & benefits"},

  /* ---- WHAT WODOUH IS, in its own words.
     The page already argues the product well — a hero that names one decision,
     a problem, three steps, six features. What it never did was say what the
     thing IS, so a reader who arrived from a forwarded link met a contract
     scanner and left with no idea it was anything more.
     This is a positioning layer, not a promise layer. "نظامك الشخصي لذكاء
     العقود" is deliberately followed, in the same block, by the concrete list
     of what actually happens — because "system" left on its own would be read
     as a place your contracts are kept and watched, and Wodouh keeps nothing,
     watches nothing and compares nothing. Nothing here is new capability;
     every clause below already ships. */
  k_pos:{ar:"وش هو وضوح",en:"What Wodouh is"},
  pos_h:{ar:"وضوح — نظامك الشخصي لذكاء العقود",
         en:"Wodouh — your personal contract intelligence system"},
  pos_verbs:{ar:"افهم عقودك. اعرف حقوقك. اكتشف المخاطر. وكن مستعدًا.",
             en:"Understand your contracts. Know your rights. Spot risks. Stay ahead."},
  pos_p:{ar:"أي عقد قدّامك — عمل أو إيجار أو عمل حر — تفتحه في وضوح وتطلع منه فاهم: تقييمه، والبنود اللي تنتبه لها ومصدرها من النظام، ومستحقاتك إذا انتهى، وخطاب تفاوض جاهز إذا حبيت ترد. القرار قرارك، ودورنا إنك تاخذه وأنت داري.",
         en:"Any contract in front of you — employment, rental or freelance — you open it in Wodouh and come out understanding it: the score, the clauses to watch and where each one sits in the law, what you're owed if it ends, and a negotiation letter ready if you want to answer back. The decision stays yours; our job is that you make it knowing."},

  k_problem:{ar:"المشكلة",en:"The problem"},
  problem_h:{ar:"العقود مكتوبة عشان تُوقَّع، مو عشان تُفهَم.",en:"Contracts are written to be signed, not to be understood."},
  problem_p:{ar:"أغلبنا يوقّع وهو ما يدري وش وافق عليه بالضبط — لأن السؤال يجي في وقت ما فيه مجال للتردد. هذي مواقف نسمعها كثيرًا:",
             en:"Most of us sign without knowing exactly what we agreed to — because the question arrives at the moment there's least room to hesitate. Situations we hear often:"},
  q1:{ar:"«وقّعت وأنا واثق… وبعد سنة اكتشفت إن بند عدم المنافسة يمنعني أشتغل في مجالي كامل.»",
      en:"“I signed confidently — a year later I found the non-compete blocked my whole field.”"},
  q1s:{ar:"موظف",en:"An employee"},
  q2:{ar:"«المالك طلب مني الإخلاء خلال أسبوع. ما كنت أدري إن البند اللي وقّعت عليه يعطيه هذا الحق.»",
      en:"“The landlord asked me to leave within a week. I didn't know the clause I signed gave him that right.”"},
  q2s:{ar:"مستأجر",en:"A tenant"},
  q2note:{ar:"وهذا النوع من البنود قابل للاعتراض غالبًا — عقدك المسجّل في إيجار هو سندك.",
          en:"A clause like that is usually contestable — your Ejar-registered contract is your proof."},
  q3:{ar:"«سلّمت المشروع وانتظرت 60 يومًا عشان أستلم. الاتفاق كان يقول كذا فعلًا.»",
      en:"“I delivered and waited sixty days to get paid. The agreement did say so.”"},
  q3s:{ar:"مستقل",en:"A freelancer"},

  k_how:{ar:"كيف يشتغل",en:"How it works"},
  how_h:{ar:"ثلاث خطوات، وأقل من دقيقة.",en:"Three steps, under a minute."},
  st1:{ar:"ارفع أو الصق",en:"Upload or paste"},
  st1p:{ar:"ارفع ملف PDF أو الصق نص العقد. يُقرأ على جهازك، وما يُرفع إلا إذا كان ممسوحًا ضوئيًا ووافقت.",
        en:"Upload a PDF or paste the text. It's read on your device, and only uploaded if it's a scan and you agree."},
  st2:{ar:"اقرأ الخلاصة",en:"Read the verdict"},
  st2p:{ar:"تقييم من 100، وكل بند مشروح بلغة بسيطة: أحمر انتبه، أصفر فاوض، أخضر مطمئن.",
        en:"A score out of 100 and every clause in plain language: red to pause, amber to negotiate, green to relax."},
  st3:{ar:"أرسل خطابك",e:"",en:"Send your letter"},
  st3p:{ar:"أضف البنود وأنت تقرأ، ونجمعها لك خطاب تفاوض مهذب وواثق ترسله كما هو.",
        en:"Add points as you read and we assemble a polite, confident letter you can send as is."},

  k_feat:{ar:"وش تحصل عليه",en:"What you get"},
  feat_h:{ar:"من قبل التوقيع… إلى بعد ما ينتهي.",en:"From before you sign to after it ends."},
  f1:{ar:"تقييم العقد",en:"Contract score"},
  f1p:{ar:"رقم واضح وخلاصة صريحة، مع شرح كل بند وسبب تصنيفه.",en:"A clear number and an honest verdict, with every clause explained and why it's flagged."},
  f2:{ar:"خطاب التفاوض",en:"Negotiation letter"},
  f2p:{ar:"يُبنى وأنت تقرأ — صيغة جاهزة بالعربي والإنجليزي ترسلها للطرف الآخر.",en:"Built as you read — ready bilingual wording to send the other party."},
  f3:{ar:"تذكيرات المواعيد",en:"Deadline reminders"},
  f3p:{ar:"فترة التجربة، نافذة الإشعار، التجديد — ننبّهك قبلها بوقت كافٍ.",en:"Probation, notice windows, renewals — we nudge you well before each one."},
  f4:{ar:"حاسبة نهاية الخدمة",en:"End-of-service calculator"},
  f4p:{ar:"رقم دقيق بالحساب خطوة بخطوة، وكل مبلغ بمصدره ودرجة يقينه.",en:"An exact figure with the arithmetic shown, each amount with its source and how certain it is."},
  f5:{ar:"المساعد القانوني",en:"Legal assistant"},
  f5p:{ar:"مساعد مدعوم بالذكاء الاصطناعي: اسأل بلغتك العادية عن أي بند أو نظام، ويقول لك متى تحتاج محاميًا فعلًا.",en:"An AI-assisted helper: ask about any clause or law in your own words — and it tells you when you genuinely need a lawyer."},
  f6:{ar:"وضوح للأعمال",en:"Wodouh for Business"},
  f6p:{ar:"للشركات: مقاعد للفريق، ومراجعة التعديلات، وتقييم قوالبكم الصادرة من وجهة نظر الطرف الآخر.",
       en:"For companies: team seats, redline review, and scoring for your own outgoing templates from the other side's view."},

  k_price:{ar:"الأسعار",en:"Pricing"},
  /* "المخرجات" is software jargon — nobody in Saudi says "outputs" about a
     letter or a case file. The English was the natural sentence here and the
     Arabic was the derivative, on the pricing headline of an Arabic-first
     product. */
  price_h:{ar:"الحقيقة مجانية. اللي تدفع عليه هو الورق اللي تستخدمه.",en:"The truth is free. You pay for the outputs."},
  price_p:{ar:"التقييم والقرار وحاسبة نهاية الخدمة مجانية دائمًا — عشان ما نكون طرفًا في قرارك. فحص كامل لكل البنود له سعره.",
           en:"The score, the verdict, and the calculator are always free — so we're never a party to your decision. A full clause-by-clause review is priced."},
  p1:{ar:"وضوح الأساسي",en:"Wodouh Basic"}, p1a:{ar:"مجاني",en:"Free"},
  /* Wording matches plan_review_d (app/index.html) verbatim, on purpose — this
     card and the app catalogue describe the same 199 SAR product, and reusing
     the sentence is what stops the two from drifting apart again. */
  p1b:{ar:"المراجعة الكاملة",en:"Full contract review"},
  p1bp:{ar:"كل بند، وكل ملاحظة، مع مصدرها من النظام — لعقد واحد.",en:"Every clause, every flag, each with its source in the law — for one contract."},
  p1bg:{ar:"تحصل على: تقييم كامل لكل بند، ومصدر كل ملاحظة من النظام.",
        en:"You get: a full review of every clause, with each note's source in the law."},
  p1p:{ar:"فحص مجاني واحد كل شهر: تقييمك، والقرار، وأخطر تنبيه.",en:"One free scan a month: your score, the verdict, and the most serious flag."},
  p2:{ar:"خطاب التفاوض",en:"Negotiation letter"},
  p2p:{ar:"لكل عقد — صيغة جاهزة مبنية على بنودك، بالعربي والإنجليزي.",en:"Per contract — ready wording built from your own clauses, in both languages."},
  p3:{ar:"ملف القضية",en:"Case file"},
  p3p:{ar:"مطالبتك ومستنداتك ووقائعك في ملف واحد — جاهز للتسوية أو للمحامي.",en:"Your claim, documents and facts in one file — ready for settlement or a lawyer."},
  /* Wording tracks plan_bundle / plan_bundle_d in the app catalogue, and the
     price is asserted equal to it by test/commerce.test.js. */
  p4:{ar:"الحزمة الكاملة",en:"Full bundle"},
  p4t:{ar:"الأفضل قيمة",en:"Best value"},
  p4p:{ar:"المراجعة الكاملة، وملف القضية، وخطاب التفاوض — أقل من مجموعها.",
       en:"The full review, the case file and the negotiation letter — for less than their sum."},
  p4g:{ar:"تحصل على: الثلاثة كاملة، وتوفّر 148 ر.س عن شرائها منفصلة.",
       en:"You get: all three, saving 148 SAR against buying them separately."},
  price_anchor:{ar:"وقت المحامي أغلى من هذا، وقد تحتاجه بعد ذلك أيضًا — وضوح يجهّز لك ملفك قبل أن تذهب إليه.",
                en:"A lawyer's time costs more than this, and you may still need one afterward — Wodouh gets your file ready before you go."},
  price_vat:{ar:"السعر المعروض هو المبلغ النهائي، ولا تُضاف ضريبة · ما أعجبك خلال 14 يومًا؟ نرجّع لك المبلغ — حتى لو استخدمته.",
             en:"The price shown is the total you pay, no VAT added · Not happy within 14 days? We refund you — even if you already used it."},
  p1g:{ar:"تحصل على: التقييم، والقرار، وأول تنبيه، وحاسبة نهاية الخدمة.",
       en:"You get: the score, the decision, the first flag, and the end-of-service calculator."},
  p2g:{ar:"تحصل على: نص خطاب كامل قابل للتعديل، بالعربي والإنجليزي، مبني على بنودك.",
       en:"You get: a complete editable letter in Arabic and English, built from your clauses."},
  p3g:{ar:"تحصل على: ملف يجمع الوقائع والمطالبة بالأرقام وقائمة مستنداتك.",
       en:"You get: a file with the facts, the claim in figures, and your document list."},

  k_trust:{ar:"الثقة",en:"Trust"},
  trust_h:{ar:"نقول لك بالضبط وش نسوي — ووش ما نسويه.",en:"We tell you exactly what we do — and what we don't."},
  t1:{ar:"عقدك يُقرأ على جهازك",en:"Your contract is read on your device"},
  t1p:{ar:"يُقرأ ويُحلَّل داخل التطبيق، وما نخزّنه ولا نشاركه مع أحد. الاستثناءات الوحيدة اختيارية، وما تصير إلا بموافقتك — ومنها رفع العقود الممسوحة ضوئيًا عشان نقدر نقرأها.",
       en:"It's read and analyzed inside the app, and we don't store it or share it. The only exceptions are optional and happen only with your consent — including uploading scanned contracts so they can be read at all."},
  t2:{ar:"محتوانا يراجعه محامٍ مرخّص",en:"Reviewed by a licensed lawyer"},
  /* NO LAWYER PROMISE HERE. This said "for complex matters we connect you
     with a licensed Saudi lawyer" while LAWYER_COMPILED is false and the
     app's own comment says the arrangement "lives outside this repository
     and cannot be verified from here". The app ships that promise dark on
     purpose; this page was making it anyway. It returns when the desk is
     live and something real stands behind it. */
  t2p:{ar:"يراجع محامٍ سعودي مرخّص محتوانا النظامي قبل نشره. ووضوح نفسه ليس مكتب محاماة: نشرح ونساعدك تفهم وتقرر، وإذا كانت حالتك تحتاج رأيًا مهنيًا نقول لك ذلك بوضوح.",
       en:"Our legal content is reviewed by a licensed Saudi lawyer before publication. Wodouh itself is not a law firm: we explain and help you understand and decide, and when your situation needs professional judgement, we tell you so plainly."},
  t3:{ar:"نقول لك كيف حكمنا",en:"We show our reasoning"},
  t3p:{ar:"كل بند مُعلَّم مع سببه ومرجعه من نظام العمل السعودي — وكل مصدر منشور برابطه الرسمي وتاريخ مراجعته في صفحة كيف نتحقق. المراجع محدّثة حتى فبراير 2025، تاريخ نفاذ آخر تعديلات النظام.",
       en:"Every flag carries its reason and its reference in the Saudi Labor Law — and every source is published, with its official link and review date, on our how-we-verify page. References are current to February 2025, when the latest amendments came into force."},

  k_faq:{ar:"أسئلة",en:"Questions"},
  faq_h:{ar:"اللي يسألونه عادة",en:"What people usually ask"},
  faq:{ar:[
    ["هل عقدي محفوظ عندكم؟","لا. يُقرأ العقد ويُحلَّل داخل التطبيق على جهازك، وما نخزّنه. الاستثناءات الوحيدة اختيارية وما تصير إلا بطلبك — العقد الممسوح ضوئيًا لازم يُرفع عشان نقدر نقرأه أصلًا، ونقول لك قبلها. ولو حذفت التطبيق راح معه كل شيء عندك."],
    ["وقّعت بالفعل، أو انتهى عقدي — فات الأوان؟","لا. وضوح يقرأ العقد الموقّع ويوضّح وش ملزم ووش قابل للاعتراض، ويحسب مستحقاتك عند الإنهاء. والدعوى العمالية لا تُسمع بعد 12 شهرًا من انتهاء العلاقة (نظام العمل، المادة 222)، فالوقت يهم."],
    ["هل يغني عن المحامي؟","لا. يراجع محامٍ سعودي مرخّص محتوانا النظامي قبل نشره، وهذه المراجعة هي ما يقف خلف المواد التي نستشهد بها — لكن وضوح نفسه ليس مكتب محاماة ولا يقدّم تمثيلًا قانونيًا. عند النزاع الفعلي أو المبالغ الكبيرة تحتاج محاميًا خاصًا بك، ووضوح يجهّز لك ملفك قبل أن تذهب إليه."],
    ["يشتغل على العقود العربية؟","نعم، عربي وإنجليزي. بعض ملفات PDF العربية المصوّرة تحتاج نسخ النص يدويًا، وسنقول لك بصراحة إذا ما قدرنا نقرأ الملف."],
    ["وش أنواع العقود المدعومة؟","عقود العمل، والإيجار، والعمل الحر حاليًا — وهي الأكثر توقيعًا في السعودية."],
    ["ليش التقييم مجاني؟","لأن المنتج كله قايم على إنك تثق فينا. لو كسبنا من إظهار مخاطر أكثر، ما عاد لتقييمنا معنى."],
    ["هل تُضاف ضريبة على السعر؟","لا. السعر المعروض هو المبلغ النهائي، ولا تُضاف عليه ضريبة قيمة مضافة — وضوح غير مسجَّل فيها حاليًا."],
    ["وإذا ما عجبني الخطاب؟","نرجّع لك المبلغ خلال 14 يومًا بدون أسئلة. تدفع مقابل مخرج تستخدمه فعلًا، مو مقابل تجربة."],
    ["من وين تجيبون معلوماتكم؟","من المصادر الرسمية: نظام العمل السعودي (المرسوم الملكي م/51 وتعديلاته)، ووزارة الموارد البشرية، وشبكة إيجار، ووزارة العدل. المصادر معروضة داخل التطبيق بروابطها وتاريخ مراجعتها، ونذكر رقم المادة فقط حين نتحقق منه."],
    ["متى تنصحوني بمحامي؟","حين نلقى بندًا أحمر، أو حين يكون في مطالبة أو مبلغ كبير — نقولها لك صراحة في شاشة النتيجة ونجهّز ملفك قبل ما تروح للمحامي."]
  ], en:[
    ["Do you keep my contract?","No. It's read and analyzed inside the app on your device, and we don't store it. The only exceptions are optional and happen only when you ask for them — a scanned contract has to be uploaded to be read at all, and we tell you before it is. Delete the app and everything we hold on your device goes with it."],
    ["I already signed, or my contract ended — is it too late?","No. Wodouh reads a signed contract and shows what binds you and what remains contestable, and calculates what you're owed on termination. A labour claim is not heard after 12 months from the end of the relationship (Labor Law, Article 222), so timing matters."],
    ["Does this replace a lawyer?","No. Our legal content is reviewed by a licensed Saudi lawyer before publication, which is what stands behind the articles we cite — but Wodouh itself is not a law firm and does not provide legal representation. For a real dispute or large sums you need a lawyer of your own; Wodouh gets your file ready before you go."],
    ["Does it work on Arabic contracts?","Yes, Arabic and English. Some scanned Arabic PDFs need the text pasted manually, and we'll tell you plainly when we can't read a file."],
    ["Which contracts are supported?","Employment, rental, and freelance for now — the ones most people in Saudi Arabia actually sign."],
    ["Why is the score free?","Because the whole product rests on you trusting it. If we earned more by finding more risk, the score would stop meaning anything."],
    ["Is VAT added to the price?","No. The price shown is the total you pay, and no VAT is added — Wodouh is not currently registered for VAT."],
    ["What if the letter isn't useful?","We refund you within 14 days, no questions. You're paying for an output you actually use, not for a trial."],
    ["Where does your information come from?","Official sources: the Saudi Labor Law (Royal Decree M/51 and its amendments), the Ministry of Human Resources, the Ejar network, and the Ministry of Justice. They're listed in the app with links and review dates, and we name an article number only where we've verified it."],
    ["When do you tell me to get a lawyer?","Whenever we find a red flag, or there's a claim or a large sum involved — we say so plainly on the result screen and prepare your file before you go."]
  ]},

  close_h:{ar:"قبل ما توقّع… خلنا نقرأه معك.",en:"Before you sign — let's read it together."},
  /* .launch-only — see below for the .soon-only twin. This one promises
     instant analysis; under the curtain the only button next to it is a
     contact link, so someone reading this and then pressing that button
     would find the promise didn't hold. */
  close_p:{ar:"حلّل عقدك الآن. فحص مجاني كل شهر، والعقد يُقرأ على جهازك.",
           en:"Analyze your contract now. A free scan every month, read on your device."},
  close_p_soon:{ar:"ما فتحناه للكل بعد. عندك عقد قدّامك اليوم؟ كلّمنا ونقرأه معك.",
                en:"We haven't opened to everyone yet. Have a contract in front of you today? Talk to us and we'll read it with you."},
  close_cta:{ar:"اعرف وضع عقدي مجانًا",en:"See where my contract stands — free"},
  /* The disclosure every other surface makes and this page did not: it sold
     an AI assistant without the word "AI" appearing anywhere on it, in either
     language. Wording reused from terms/index.html rather than newly written. */
  foot:{ar:"وضوح منصّة تقنية تقدّم معلومات قانونية عامة وأدوات مدعومة بالذكاء الاصطناعي. يراجع محامٍ سعودي مرخّص محتوانا النظامي قبل نشره. ووضوح نفسه ليس مكتب محاماة ولا يقدّم تمثيلًا قانونيًا، وما ينتجه الذكاء الاصطناعي قد يكون خاطئًا — وما يغني عن الاستشارة القانونية عند الحاجة.",
        en:"Wodouh is a technology platform providing general legal information and AI-assisted tools. Our legal content is reviewed by a licensed Saudi lawyer before publication. Wodouh itself is not a law firm and does not provide legal representation, and AI output can be wrong — it does not replace legal advice when you need it."},
  /* Reused verbatim from the legal pages' identification block, so the
     operator is described the same way everywhere. */
  foot_id:{ar:"يُدار وضوح كنشاط سعودي مستقل بموجب وثيقة عمل حر، وليس لديه سجل تجاري. ولا نعرض أي شعار أو ترخيص أو اعتماد حكومي لا نملكه. للتواصل والشكاوى: support@alwodouh.com",
           en:"Wodouh is operated as an independent Saudi activity under a Freelance Work Certificate and does not hold a Commercial Registration. We display no licence, seal or government approval that we do not hold. Contact and complaints: support@alwodouh.com"},
};

let lang = "ar";
const t = k => T[k][lang];

function applyLang(){
  document.documentElement.lang = lang;
  if (typeof setDir === "function") setDir();
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  /* Kept in step with the static <title> in index.html: the positioning
     first, the search-intent line after it in Arabic, which is the page's
     primary language and the one people type their question in. */
  document.title = lang === "ar"
    ? "وضوح — نظامك الشخصي لذكاء العقود · اقرأ عقدك قبل ما توقّع"
    : "Wodouh — Your Personal Contract Intelligence System";
  document.getElementById("langBtn").textContent = lang === "ar" ? "English" : "عربي";
  document.querySelectorAll("[data-t]").forEach(el => { el.textContent = t(el.dataset.t); });
  const sar = lang === "ar" ? "ر.س" : "SAR";
  /* THESE MUST EQUAL THE APP CATALOGUE. They are a second copy of numbers that
     live in app/index.html, and they drifted: this page advertised 65 and 325
     while the app charged 149 and 349, and sold a "job-change pack" at 130
     that was not a product at all. Someone was invited to reserve a launch
     price 84 SAR below what checkout would ask.
     There is no build step to share a constant between these two files, so
     the agreement is enforced by test/commerce.test.js, which reads both and
     fails when they differ. */
  /* ONE NUMERAL CONVENTION, AND IT IS THE APP'S.
     This page wrote ١٤٩ and م/٥١ while the app it links to writes 149 and
     م/51 — the same price in two scripts, one tap apart. app/index.html
     settled the question and says why: readers here move between Arabic
     contracts, bank apps and government portals that mostly use Latin
     digits, and a figure you have to re-read is a figure you do not trust.
     The language no longer changes the numerals. */
  document.getElementById("p1ba").innerHTML = "199" + `<small>${sar}</small>`;
  document.getElementById("p2a").innerHTML = "149" + `<small>${sar}</small>`;
  document.getElementById("p3a").innerHTML = "349" + `<small>${sar}</small>`;
  document.getElementById("p4a").innerHTML = "549" + `<small>${sar}</small>`;
  document.getElementById("faq").innerHTML = T.faq[lang].map(([q,a]) =>
    `<details><summary>${q}<svg class="m" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg></summary><div class="ans"><div><p>${a}</p></div></div></details>`
  ).join("");
}
function toggleLang(){ lang = lang === "ar" ? "en" : "ar"; applyLang(); }
/* CSP is script-src 'self' with no 'unsafe-inline', so the inline
   onclick="toggleLang()" this used to have on #langBtn was silently inert in
   any spec-compliant browser — the click fired, the CSP blocked the handler,
   and nothing happened. No console error either; it just never worked. The
   only interactive control on the whole landing page was dead. Wired here
   instead, alongside the rest of this file's addEventListener calls. */
document.getElementById("langBtn").addEventListener("click", toggleLang);

/* ---- motion layer: additive, and never a prerequisite for content ---- */
const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)");

/* Reveal on scroll. Elements are visible in markup; JS opts them in, so a
   failure here can never hide a section. */
let revealIO = null;
function armReveals(){
  if (REDUCED.matches || !("IntersectionObserver" in window)) return;
  revealIO = new IntersectionObserver(es=>es.forEach(e=>{
    if (e.isIntersecting){ e.target.classList.add("in"); revealIO.unobserve(e.target); }
  }), { threshold:.12, rootMargin:"0px 0px -8% 0px" });
  document.querySelectorAll("section:not(.hero) .kicker, section:not(.hero) h2, .sec-lede, .pos-verbs, .quote, .step, .feat, .price, .anchor, .vat, .trust-item, details, .close h2, .close p, .close .btn")
    .forEach((el,i)=>{
      if (el.getBoundingClientRect().top < window.innerHeight * 0.9){ el.classList.add("rv","in"); return; }
      el.classList.add("rv");
      const within = i % 3;
      if (within) el.classList.add("rv-d" + within);
      revealIO.observe(el);
    });
}

/* Safety net: on a very short viewport, or under fast or programmatic
   scrolling, the observer can coalesce past an element taller than the screen
   and leave it invisible for good. Content visibility must never depend on how
   quickly someone scrolls, so anything whose top has reached the viewport is
   revealed regardless of observer timing. */
let sweepQueued = false;
function sweepReveals(){
  sweepQueued = false;
  document.querySelectorAll(".rv:not(.in)").forEach(el=>{
    if (el.getBoundingClientRect().top < window.innerHeight){
      el.classList.add("in");
      if (revealIO) revealIO.unobserve(el);
    }
  });
}
function queueSweep(){
  if (sweepQueued) return;
  sweepQueued = true;
  requestAnimationFrame(sweepReveals);
}

/* Nav condensation and a capped parallax drift on the hero card. */
function onScroll(){
  const nav = document.querySelector(".nav");
  if (nav) nav.classList.toggle("tight", window.scrollY > 90);
  if (REDUCED.matches) return;
  const shot = document.querySelector(".shot");
  if (shot && window.scrollY < 900){
    const d = Math.max(-14, Math.min(14, window.scrollY * -0.045));
    shot.style.transform = "translateY(" + d + "px)";
  }
}

/* Direction token so the score rows slide in from the reading edge. */
function setDir(){
  document.documentElement.style.setProperty("--dir", lang === "ar" ? "-1" : "1");
}

/* the hero score counts up once, when it first comes into view */
function animateScore(){
  const arc = document.getElementById("arc"), num = document.getElementById("num"), target = 68;
  arc.style.strokeDashoffset = String(333 * (1 - target/100));
  const t0 = performance.now();
  (function tick(now){
    const k = Math.min(1, (now - t0) / 1300);
    num.textContent = String(Math.round(target * (1 - Math.pow(1 - k, 3))));
    if (k < 1) requestAnimationFrame(tick);
  })(t0);
}

applyLang();
armReveals();
window.addEventListener("scroll", onScroll, { passive:true });
window.addEventListener("scroll", queueSweep, { passive:true });
window.addEventListener("resize", queueSweep, { passive:true });
window.addEventListener("load", sweepReveals);
onScroll();
const shot = document.querySelector(".shot");
if (window.matchMedia("(prefers-reduced-motion: reduce)").matches){
  document.getElementById("arc").style.strokeDashoffset = String(333 * 0.32);
  document.getElementById("num").textContent = "68";
} else if ("IntersectionObserver" in window){
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting){ animateScore(); io.disconnect(); }
  }), { threshold:.4 });
  io.observe(shot);
} else animateScore();
