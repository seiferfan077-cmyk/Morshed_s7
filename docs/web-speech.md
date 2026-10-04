# Web Speech داخل متصفح مُرشد

## المسار الإنتاجي

`Web Page → Web Speech facade → ReactNativeWebView.postMessage → speech bridge → expo-speech/Android TTS → Audio Output`

الجسر مركب في `src/services/speech/webSpeechBridge.ts` ويُحقن في **الإطار الرئيسي فقط**. لا يتم حقنه داخل iframes، والرسائل المقبولة يجب أن تحمل namespace `murshid.webSpeech.v1` وتطابق schema الجسر. لا يوجد selector أو زر خاص بموقع بعينه.

## التوافق

يدعم الجسر:

- `speechSynthesis`
- `SpeechSynthesisUtterance`
- `SpeechSynthesisVoice`
- `speak()` مع queue حقيقي عبر Android TTS
- `cancel()` لمسح المحرك والقائمة
- `getVoices()` و`voiceschanged`
- `lang` واختيار voice عند توفر `voiceURI`
- `onstart`, `onend`, `onerror`, `onboundary`
- `pause()` و`resume()` بشكل صريح: يرفعان `NotSupportedError` على Android بدل fake implementation

`onboundary` يأتي من callback native في `expo-speech` ويرسل `charIndex` و`charLength`، وليس من مؤقت JavaScript.

## التشخيص والاختبار

من قائمة المتصفح افتح **اختبار الصوت**. الصفحة المستقلة تختبر كشف الواجهة، الأصوات، العربية، الإنجليزية، تبديل اللغة، الإلغاء، queue والأحداث. لوحة **التشخيص** تعرض:

- Web Speech API detected
- speechSynthesis initialized
- getVoices()
- Selected voice / Language
- speak() received
- Bridge received
- Native TTS started
- Audio started
- boundary events
- Audio ended
- Error

## اختبار قبول على Android فعلي

1. ابنِ development/release APK بعد `expo prebuild`/EAS؛ `expo-speech` وحدة native ولا تعمل بكاملها في Expo Go.
2. تأكد أن الجهاز يحتوي على Android TTS engine وصوت عربي وإنجليزي مثبتين.
3. ارفع صوت Media، أوقف Mute/Do Not Disturb، وتحقق من Audio output.
4. افتح **اختبار الصوت** واضغط النطق العربي ثم الإنجليزي، ثم راجع التشخيص.
5. افتح موقعًا خارجيًا يستخدم:

```js
speechSynthesis.speak(new SpeechSynthesisUtterance('Hello'));
```

6. يجب أن يظهر `Bridge received` ثم `Native TTS started` ثم `Audio ended` مع سماع الصوت فعليًا.

نجاح TypeScript وحده لا يثبت خروج الصوت؛ الاعتماد النهائي هو اختبار APK على جهاز Android حقيقي.
