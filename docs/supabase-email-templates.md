# قوالب الإيميل — Supabase

الإيميلات هلّق طالعة من عنوان Supabase وبالإنكليزي. هيدا **إعداد بلوحة Supabase مش كود**،
وهيدي النصوص جاهزة للّصق.

الترتيب مهم: **٣ قبل ١ و٢**. لأنو ٣ هو يلي بيخلّي الرابط يشتغل من أي متصفّح.

---

## ٣. الرابط (الأهم)

**Authentication ← Emails ← Templates ← Reset Password**

الرابط الافتراضي (`{{ .ConfirmationURL }}`) بيشتغل **بس من نفس المتصفّح يلي طلب الاستعادة**.
والناس بتطلب من الموقع وبتفتح الإيميل من تطبيق Gmail — وهيدا متصفّح تاني، فبيفشل.

بدّلو بهيدا:

```
{{ .SiteURL }}/ar/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/ar/reset-password
```

> الكود بيقبل الشكلين، فالإصلاح شغّال حتى بلا هالتعديل — بس بلاه رح يضلّ في ناس بتفشل
> بلا سبب ظاهر.

---

## ١. نص "استعادة كلمة المرور"

```html
<div dir="rtl" style="font-family:system-ui,-apple-system,'Segoe UI',Tahoma,sans-serif;
     background:#f6f7f9;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;
       padding:32px;border:1px solid #e6e8eb;">

    <p style="margin:0 0 4px;font-size:20px;font-weight:800;color:#111;">متجر</p>
    <p style="margin:0 0 24px;font-size:13px;color:#6b7280;">matjarlb.com</p>

    <h1 style="margin:0 0 12px;font-size:19px;font-weight:800;color:#111;">
      طلبت تغيير كلمة المرور
    </h1>

    <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#374151;">
      اضغط الزر تحت لتختار كلمة مرور جديدة لحسابك.
    </p>

    <a href="{{ .SiteURL }}/ar/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/ar/reset-password"
       style="display:inline-block;background:#111;color:#fff;text-decoration:none;
              padding:13px 28px;border-radius:12px;font-weight:700;font-size:15px;">
      اختار كلمة مرور جديدة
    </a>

    <p style="margin:24px 0 0;font-size:13px;line-height:1.8;color:#6b7280;">
      الرابط بيشتغل <strong>مرّة وحدة</strong> وبينتهي بعد ساعة.<br>
      إذا ما انت يلي طلبتو، ما في شي لازم تعملو — حسابك متل ما هو.
    </p>

  </div>
</div>
```

---

## ٢. المرسِل

**Authentication ← Emails ← SMTP Settings**

بلا هالخطوة الإيميل بيضلّ طالع من عنوان Supabase، وكتير منّو بيروح عالـSpam
لأنو الدومين مش دومينك.

- خدمة مجانية بتكفي الحجم الحالي: **Resend** أو **Brevo**
- المرسِل: `no-reply@matjarlb.com`
- الاسم: `متجر`

بدها تثبيت الدومين عند الخدمة (سجلّات DNS) — الخدمة بتعطيك ياهن.

---

## بعد ما تخلّص

اطلب استعادة على إيميلك، وافتح الرابط **من تلفون تاني أو متصفّح تاني** عن قصد.
إذا اشتغل، يعني الخطوة ٣ زبطت — وهيدي هي الحالة يلي كانت بتفشل.
