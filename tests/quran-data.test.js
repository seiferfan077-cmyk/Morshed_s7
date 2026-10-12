const assert = require('node:assert/strict');
const quran = require('../src/data/quran-uthmani.json');

assert.equal(quran.source.title, 'Tanzil Quran Text (Uthmani, Version 1.1)');
assert.equal(quran.source.license, 'Creative Commons Attribution 3.0');
assert.equal(quran.source.url, 'https://tanzil.net/');
assert.match(quran.source.notice, /CHANGING IT IS NOT ALLOWED/);
assert.equal(quran.surahs.length, 114);
assert.equal(quran.surahs[0].name, 'الفاتحة');
assert.equal(quran.surahs[113].name, 'الناس');

let totalAyahs = 0;
for (let index = 0; index < quran.surahs.length; index += 1) {
  const surah = quran.surahs[index];
  assert.equal(surah.index, index + 1, `Surah order mismatch at ${index + 1}`);
  assert.ok(surah.name.length > 0, `Surah name missing at ${index + 1}`);
  assert.ok(surah.verses.length > 0, `Ayahs missing in surah ${index + 1}`);
  for (let ayahIndex = 0; ayahIndex < surah.verses.length; ayahIndex += 1) {
    const ayah = surah.verses[ayahIndex];
    assert.equal(ayah.index, ayahIndex + 1, `Ayah order mismatch in surah ${index + 1}`);
    assert.ok(ayah.text.length > 0, `Ayah text missing at ${index + 1}:${ayahIndex + 1}`);
    totalAyahs += 1;
  }
}
assert.equal(totalAyahs, 6236);
assert.equal(quran.surahs[0].verses[0].text, 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ');
assert.equal(quran.surahs[113].verses[5].text, 'مِنَ ٱلْجِنَّةِ وَٱلنَّاسِ');
assert.ok(quran.surahs[1].verses[0].bismillah);
assert.equal(quran.surahs[8].verses[0].bismillah, undefined);

console.log('Quran data integrity tests passed (114 surahs, 6236 ayahs)');
