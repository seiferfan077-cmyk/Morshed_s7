import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import tasbihData from '../data/tasbihTexts.json';
import { RuqaaText as Text } from '../components/RuqaaText';
import { SurfaceCard } from '../components/SurfaceCard';
import { radii, spacing, ThemeColors, typography } from '../theme';
import {
  calculateRepeatIncrement,
  decrementTasbihCount,
  getNextFocusIndex,
  getRepeatStep,
  getTasbihProgressPercent,
  normalizeActiveTasbihId,
  normalizeFocusTarget,
  normalizeRepeatSettings,
  normalizeRepeatStep,
  normalizeTasbihCount,
  normalizeTasbihCounts,
  TASBIH_MAX_FOCUS_TARGET,
  TASBIH_MAX_REPEAT_STEP,
  TASBIH_TARGET,
  TasbihRepeatSettings,
} from '../services/tasbih/tasbihPolicy';

type DhikrCategory = (typeof tasbihData.categories)[number];
const STORAGE_KEY = '@murshid/tasbih-progress:v3';
const LEGACY_STORAGE_KEYS = ['@murshid/tasbih-progress:v2', '@murshid/tasbih-progress:v1'];
const DHIKR_IDS = tasbihData.items.map((item) => item.id);
const CATEGORY_BY_ID = new Map<string, DhikrCategory>(tasbihData.categories.map((category) => [category.id, category]));
const INITIAL_VISIBLE = 20;
const QUICK_STEPS = [1, 2, 3, 5, 10];

function formatArabicCount(value: number) {
  return value.toLocaleString('en-US')
    .replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)])
    .replace(/,/g, '٬');
}

function normalizeSearch(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .trim();
}

export function TasbihSection({ colors }: { colors: ThemeColors }) {
  const styles = createStyles(colors);
  const [activeId, setActiveId] = useState(DHIKR_IDS[0] ?? '');
  const [counts, setCounts] = useState<Record<string, number>>(() => normalizeTasbihCounts({}, DHIKR_IDS));
  const [favorites, setFavorites] = useState<string[]>([]);
  const [repeatSettings, setRepeatSettings] = useState<TasbihRepeatSettings>(() => normalizeRepeatSettings({}, DHIKR_IDS));
  const [focusQueue, setFocusQueue] = useState<string[]>([]);
  const [focusProgress, setFocusProgress] = useState(0);
  const [focusActive, setFocusActive] = useState(false);
  const [focusStatus, setFocusStatus] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(INITIAL_VISIBLE);

  const activeDhikr = tasbihData.items.find((item) => item.id === activeId) ?? tasbihData.items[0];
  const count = counts[activeDhikr.id] ?? 0;
  const progress = getTasbihProgressPercent(count);
  const targetReached = count >= TASBIH_TARGET;
  const selectedCategory = CATEGORY_BY_ID.get(activeDhikr.categoryId);
  const repeatStep = getRepeatStep(repeatSettings, activeDhikr.id);
  const focusIndex = focusQueue.indexOf(activeDhikr.id);

  const filteredItems = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    return tasbihData.items.filter((item) => {
      if (favoritesOnly && !favorites.includes(item.id)) return false;
      if (categoryId !== 'all' && item.categoryId !== categoryId) return false;
      if (!normalizedQuery) return true;
      return normalizeSearch(`${item.text} ${item.category}`).includes(normalizedQuery);
    });
  }, [categoryId, favorites, favoritesOnly, query]);
  const visibleItems = filteredItems.slice(0, visibleLimit);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      let raw = await AsyncStorage.getItem(STORAGE_KEY);
      for (const key of LEGACY_STORAGE_KEYS) {
        if (!raw) raw = await AsyncStorage.getItem(key);
      }
      if (!mounted) return;
      if (raw) {
        const saved = JSON.parse(raw) as {
          activeId?: unknown; counts?: unknown; favorites?: unknown; repeatSettings?: unknown;
          focusQueue?: unknown; focusProgress?: unknown; focusActive?: unknown;
        };
        setCounts(normalizeTasbihCounts(saved.counts, DHIKR_IDS));
        const restoredActiveId = normalizeActiveTasbihId(saved.activeId, DHIKR_IDS);
        const restoredRepeatSettings = normalizeRepeatSettings(saved.repeatSettings, DHIKR_IDS);
        setRepeatSettings(restoredRepeatSettings);
        if (Array.isArray(saved.favorites)) setFavorites(saved.favorites.filter((id): id is string => typeof id === 'string' && DHIKR_IDS.includes(id)));
        if (Array.isArray(saved.focusQueue)) {
          const queue = saved.focusQueue.filter((id): id is string => typeof id === 'string' && DHIKR_IDS.includes(id));
          if (saved.focusActive === true && queue.length > 0) {
            setFocusQueue(queue);
            setFocusActive(true);
            setActiveId(queue.includes(restoredActiveId) ? restoredActiveId : queue[0]);
            setFocusProgress(Math.min(restoredRepeatSettings.focusTarget, Math.max(0, Math.trunc(Number(saved.focusProgress) || 0))));
          } else {
            setActiveId(restoredActiveId);
          }
        } else {
          setActiveId(restoredActiveId);
        }
      }
    })().catch(() => { if (mounted) setStorageError(true); })
      .finally(() => { if (mounted) setHydrated(true); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!hydrated) return undefined;
    let mounted = true;
    const timeout = setTimeout(() => {
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
        activeId, counts, favorites, repeatSettings, focusQueue, focusProgress, focusActive,
      }))
        .then(() => { if (mounted) setStorageError(false); })
        .catch(() => { if (mounted) setStorageError(true); });
    }, 250);
    return () => { mounted = false; clearTimeout(timeout); };
  }, [activeId, counts, favorites, repeatSettings, focusQueue, focusProgress, focusActive, hydrated]);

  function setRepeatValue(nextValue: number) {
    const step = normalizeRepeatStep(nextValue);
    setRepeatSettings((current) => current.scope === 'all'
      ? { ...current, sharedStep: step }
      : { ...current, perDhikrSteps: { ...current.perDhikrSteps, [activeDhikr.id]: step } });
  }

  function setRepeatScope(scope: 'all' | 'per-dhikr') {
    const currentStep = getRepeatStep(repeatSettings, activeDhikr.id);
    setRepeatSettings((current) => scope === 'all'
      ? { ...current, scope, sharedStep: currentStep }
      : { ...current, scope, perDhikrSteps: { ...current.perDhikrSteps, [activeDhikr.id]: currentStep } });
  }

  function setFocusTarget(value: number) {
    setRepeatSettings((current) => ({ ...current, focusTarget: normalizeFocusTarget(value) }));
  }

  function beginFocusSession() {
    const queue = filteredItems.filter((item) => (counts[item.id] ?? 0) < TASBIH_TARGET).map((item) => item.id);
    if (queue.length === 0) {
      setFocusStatus('أكملت الهدف الشخصي لكل الأذكار ضمن هذا الاختيار.');
      return;
    }
    const first = queue.includes(activeDhikr.id) ? activeDhikr.id : queue[0];
    setFocusQueue(queue);
    setFocusProgress(0);
    setActiveId(first);
    setFocusActive(true);
    setFocusStatus('جلسة التركيز بدأت. سيتقدم مرشد تلقائيًا بعد اكتمال العدد لكل ذكر.');
    setConfirmReset(false);
  }

  function stopFocusSession() {
    setFocusActive(false);
    setFocusQueue([]);
    setFocusProgress(0);
    setFocusStatus('تم إيقاف جلسة التركيز.');
  }

  function moveFocusForward() {
    const nextIndex = getNextFocusIndex(focusIndex, focusQueue.length);
    if (nextIndex === null) {
      setFocusActive(false);
      setFocusQueue([]);
      setFocusProgress(0);
      setFocusStatus('أحسنت. اكتملت جلسة التركيز لكل الأذكار المختارة.');
      return;
    }
    setActiveId(focusQueue[nextIndex]);
    setFocusProgress(0);
    setFocusStatus('انتقلنا تلقائيًا إلى الذكر التالي.');
  }

  function addOne() {
    if (!hydrated || targetReached) return;
    setConfirmReset(false);
    const remainingInSession = focusActive ? repeatSettings.focusTarget - focusProgress : undefined;
    const added = calculateRepeatIncrement(count, TASBIH_TARGET, repeatStep, remainingInSession);
    if (added <= 0) return;
    setCounts((current) => ({ ...current, [activeDhikr.id]: normalizeTasbihCount(current[activeDhikr.id] + added, TASBIH_TARGET) }));
    if (focusActive) {
      const nextProgress = focusProgress + added;
      if (nextProgress >= repeatSettings.focusTarget || count + added >= TASBIH_TARGET) moveFocusForward();
      else setFocusProgress(nextProgress);
    }
  }

  function removeOne() {
    if (focusActive) return;
    setConfirmReset(false);
    setCounts((current) => ({ ...current, [activeDhikr.id]: decrementTasbihCount(current[activeDhikr.id]) }));
  }

  function resetActiveDhikr() {
    setCounts((current) => ({ ...current, [activeDhikr.id]: 0 }));
    setConfirmReset(false);
  }

  function toggleFavorite(id: string) {
    setFavorites((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  function chooseCategory(next: string) {
    setCategoryId(next);
    setVisibleLimit(INITIAL_VISIBLE);
  }

  return (
    <SurfaceCard accent={colors.amber}>
      <View style={styles.header}>
        <View style={styles.headerIcon}><Ionicons name="sparkles-outline" size={21} color={colors.tealDark} /></View>
        <View style={styles.headerCopy}>
          <View style={styles.brandEyebrow}><Text style={styles.brandEyebrowText}>MURSHID · DHIKR STUDIO</Text><View style={styles.liveDot} /></View>
          <Text style={styles.title}>السبحة الإلكترونية</Text>
          <Text style={styles.detail}>مكتبتك الخاصة للذكر، بتركيز وإيقاع يناسبك.</Text>
        </View>
      </View>

      <View style={styles.featureRibbon}>
        <View style={styles.ribbonIcon}><Ionicons name="shield-checkmark-outline" size={15} color={colors.tealDark} /></View>
        <Text style={styles.ribbonText}>محفوظة محليًا · تعمل دون اتصال · عدّ مستقل لكل نص</Text>
      </View>

      <TextInput
        accessibilityLabel="البحث في الأذكار والأدعية"
        editable={!focusActive}
        placeholder="ابحث في النص أو التصنيف"
        placeholderTextColor={colors.inkFaint}
        value={query}
        onChangeText={(value) => { setQuery(value); setVisibleLimit(INITIAL_VISIBLE); }}
        style={styles.searchInput}
        textAlign="right"
        returnKeyType="search"
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryList}>
        <Pressable accessibilityRole="button" disabled={focusActive} accessibilityState={{ selected: !favoritesOnly }} onPress={() => { setFavoritesOnly(false); chooseCategory('all'); }} style={[styles.categoryChip, !favoritesOnly && categoryId === 'all' && styles.categoryChipSelected, focusActive && styles.disabled]}>
          <Text style={[styles.categoryText, !favoritesOnly && categoryId === 'all' && styles.categoryTextSelected]}>الكل ({formatArabicCount(tasbihData.items.length)})</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={focusActive} accessibilityState={{ selected: favoritesOnly }} onPress={() => { setFavoritesOnly(true); setVisibleLimit(INITIAL_VISIBLE); }} style={[styles.categoryChip, favoritesOnly && styles.categoryChipSelected, focusActive && styles.disabled]}>
          <Ionicons name={favoritesOnly ? 'heart' : 'heart-outline'} size={14} color={favoritesOnly ? colors.paper : colors.tealDark} />
          <Text style={[styles.categoryText, favoritesOnly && styles.categoryTextSelected]}>المفضلة ({formatArabicCount(favorites.length)})</Text>
        </Pressable>
        {tasbihData.categories.map((category) => (
          <Pressable key={category.id} accessibilityRole="button" disabled={focusActive} accessibilityState={{ selected: !favoritesOnly && categoryId === category.id }} onPress={() => { setFavoritesOnly(false); chooseCategory(category.id); }} style={[styles.categoryChip, !favoritesOnly && categoryId === category.id && styles.categoryChipSelected, focusActive && styles.disabled]}>
            <Text style={[styles.categoryText, !favoritesOnly && categoryId === category.id && styles.categoryTextSelected]}>{category.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text style={styles.resultCount}>النتائج: {formatArabicCount(filteredItems.length)}</Text>
      <View style={styles.itemList}>
        {visibleItems.map((item) => {
          const selected = item.id === activeDhikr.id;
          const favorite = favorites.includes(item.id);
          return (
            <View key={item.id} style={[styles.itemRow, selected && styles.itemRowSelected]}>
              <Pressable accessibilityRole="button" disabled={focusActive} accessibilityState={{ selected }} accessibilityLabel={`اختيار: ${item.text}`} onPress={() => { setActiveId(item.id); setConfirmReset(false); }} style={[styles.itemSelect, focusActive && styles.disabled]}>
                <Text numberOfLines={3} style={[styles.itemText, selected && styles.itemTextSelected]}>{item.text}</Text>
                <Text style={styles.itemCategory}>{item.category}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={focusActive} accessibilityLabel={favorite ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'} accessibilityState={{ selected: favorite }} onPress={() => toggleFavorite(item.id)} hitSlop={8} style={styles.favoriteButton}>
                <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={20} color={favorite ? colors.amber : colors.inkFaint} />
              </Pressable>
            </View>
          );
        })}
        {filteredItems.length === 0 ? <Text style={styles.emptyText}>لا توجد نصوص مطابقة. جرّب كلمة أخرى أو اختر تصنيفًا مختلفًا.</Text> : null}
      </View>
      {filteredItems.length > visibleItems.length ? (
        <Pressable accessibilityRole="button" onPress={() => setVisibleLimit((limit) => limit + INITIAL_VISIBLE)} style={styles.moreButton}>
          <Text style={styles.moreButtonText}>عرض المزيد ({formatArabicCount(filteredItems.length - visibleItems.length)} متبقية)</Text>
        </Pressable>
      ) : null}

      <View style={styles.selectedHeader}>
        <View><Text style={styles.selectedLabel}>الذكر المحدد</Text><Text style={styles.goalText}>هدف شخصي: {formatArabicCount(TASBIH_TARGET)}</Text></View>
        <View style={styles.progressBadge}><Ionicons name="analytics-outline" size={15} color={colors.tealDark} /><Text style={styles.progressBadgeText}>{formatArabicCount(progress)}٪</Text></View>
      </View>
      <Text selectable style={styles.dhikrText}>{activeDhikr.text}</Text>
      <Text style={styles.detail}>التصنيف: {activeDhikr.category}</Text>
      {selectedCategory?.note ? <Text style={styles.noteText}>{selectedCategory.note}</Text> : null}
      {selectedCategory?.sourceNote ? <Text style={styles.sourceText}>{selectedCategory.sourceNote}</Text> : null}

      <View style={styles.counterStage}>
        <View pointerEvents="none" style={styles.counterOrbit} />
        <View pointerEvents="none" style={styles.counterOrbitInner} />
        <View pointerEvents="none" style={styles.orbitSparkOne}><Ionicons name="sparkles" size={13} color={colors.amber} /></View>
        <View pointerEvents="none" style={styles.orbitSparkTwo}><Ionicons name="sparkles" size={9} color={colors.teal} /></View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`أضف ${formatArabicCount(focusActive ? Math.min(repeatStep, repeatSettings.focusTarget - focusProgress) : repeatStep)} إلى عداد ${activeDhikr.text}. العدد الحالي ${formatArabicCount(count)} من ${formatArabicCount(TASBIH_TARGET)}`}
          accessibilityHint={`كل ضغطة تضيف ${formatArabicCount(repeatStep)}، ${focusActive ? `وبعد ${formatArabicCount(repeatSettings.focusTarget)} ينتقل تلقائيًا إلى الذكر التالي` : 'حسب إعداد التكرار الحالي'}.`}
          disabled={!hydrated || targetReached}
          onPress={addOne}
          style={({ pressed }) => [styles.counterButton, (!hydrated || targetReached) && styles.disabled, pressed && styles.counterPressed]}
        >
          <View style={styles.counterTopLine}><View style={styles.counterLiveDot} /><Text style={styles.counterEyebrow}>{focusActive ? 'جلسة تركيز' : 'جلسة الذكر'}</Text></View>
          <Text style={styles.counterValue}>{formatArabicCount(count)}</Text>
          <Text style={styles.counterCaption}>{!hydrated ? 'جارٍ استعادة العداد' : targetReached ? 'اكتمل الهدف الشخصي' : `اضغط للعدّ × ${formatArabicCount(repeatStep)}`}</Text>
        </Pressable>
      </View>

      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>تقدم هذا الذكر</Text>
        <Text style={styles.progressValue}>{formatArabicCount(count)} / {formatArabicCount(TASBIH_TARGET)}</Text>
      </View>
      <View accessibilityLabel={`التقدم ${formatArabicCount(progress)} بالمئة`} style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      <View style={styles.repeatPanel}>
        <View style={styles.panelTitleRow}><Ionicons name="repeat-outline" size={17} color={colors.tealDark} /><Text style={styles.panelTitle}>إيقاع التكرار</Text></View>
        <Text style={styles.panelHint}>كم مرة يضيف كل ضغط؟ اختر نطاق تطبيق الإعداد.</Text>
        <View style={styles.scopeRow}>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: repeatSettings.scope === 'per-dhikr' }} onPress={() => setRepeatScope('per-dhikr')} style={[styles.scopeButton, repeatSettings.scope === 'per-dhikr' && styles.scopeButtonSelected]}>
            <Text style={[styles.scopeText, repeatSettings.scope === 'per-dhikr' && styles.scopeTextSelected]}>هذا الذكر فقط</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: repeatSettings.scope === 'all' }} onPress={() => setRepeatScope('all')} style={[styles.scopeButton, repeatSettings.scope === 'all' && styles.scopeButtonSelected]}>
            <Text style={[styles.scopeText, repeatSettings.scope === 'all' && styles.scopeTextSelected]}>كل الأذكار</Text>
          </Pressable>
        </View>
        <View style={styles.stepPickerRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="زيادة عدد التكرارات لكل ضغطة" disabled={repeatStep >= TASBIH_MAX_REPEAT_STEP} onPress={() => setRepeatValue(repeatStep + 1)} style={[styles.stepButton, repeatStep >= TASBIH_MAX_REPEAT_STEP && styles.disabled]}><Ionicons name="add" size={20} color={colors.tealDark} /></Pressable>
          <View style={styles.stepValueBox}><Text style={styles.stepValue}>{formatArabicCount(repeatStep)}</Text><Text style={styles.stepValueCaption}>مرة لكل ضغطة</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="تقليل عدد التكرارات لكل ضغطة" disabled={repeatStep <= 1} onPress={() => setRepeatValue(repeatStep - 1)} style={[styles.stepButton, repeatStep <= 1 && styles.disabled]}><Ionicons name="remove" size={20} color={colors.tealDark} /></Pressable>
        </View>
        <View style={styles.quickStepRow}>{QUICK_STEPS.map((step) => <Pressable key={step} accessibilityRole="button" accessibilityState={{ selected: repeatStep === step }} onPress={() => setRepeatValue(step)} style={[styles.quickStep, repeatStep === step && styles.quickStepSelected]}><Text style={[styles.quickStepText, repeatStep === step && styles.quickStepTextSelected]}>×{formatArabicCount(step)}</Text></Pressable>)}</View>
        <View style={styles.customStepRow}>
          <Text style={styles.customStepLabel}>قيمة أخرى (١–{formatArabicCount(TASBIH_MAX_REPEAT_STEP)})</Text>
          <TextInput
            key={`${activeDhikr.id}-${repeatSettings.scope}-${repeatStep}`}
            accessibilityLabel="عدد التكرارات لكل ضغطة"
            defaultValue={String(repeatStep)}
            onEndEditing={(event) => setRepeatValue(Number(event.nativeEvent.text) || 1)}
            keyboardType="number-pad"
            selectTextOnFocus
            style={styles.customStepInput}
            textAlign="center"
          />
        </View>
      </View>

      <View style={styles.focusPanel}>
        <View style={styles.focusHeading}>
          <View style={styles.focusIcon}><Ionicons name="scan-outline" size={18} color={colors.paper} /></View>
          <View style={styles.focusCopy}><Text style={styles.focusTitle}>جلسة تركيز مرشد</Text><Text style={styles.focusDetail}>أنهِ عددًا قصيرًا ثم انتقل تلقائيًا للذكر التالي.</Text></View>
        </View>
        <View style={styles.focusSetupRow}>
          <View><Text style={styles.focusSettingLabel}>عدد كل ذكر في الجلسة</Text><Text style={styles.focusSettingHint}>من ١ إلى {formatArabicCount(TASBIH_MAX_FOCUS_TARGET)}</Text></View>
          <View style={styles.focusStepper}>
            <Pressable accessibilityRole="button" accessibilityLabel="تقليل عدد جلسة التركيز" disabled={repeatSettings.focusTarget <= 1 || focusActive} onPress={() => setFocusTarget(repeatSettings.focusTarget - 1)} style={[styles.focusStepButton, (repeatSettings.focusTarget <= 1 || focusActive) && styles.disabled]}><Ionicons name="remove" size={17} color={colors.paper} /></Pressable>
            <Text style={styles.focusStepValue}>{formatArabicCount(repeatSettings.focusTarget)}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="زيادة عدد جلسة التركيز" disabled={repeatSettings.focusTarget >= TASBIH_MAX_FOCUS_TARGET || focusActive} onPress={() => setFocusTarget(repeatSettings.focusTarget + 1)} style={[styles.focusStepButton, (repeatSettings.focusTarget >= TASBIH_MAX_FOCUS_TARGET || focusActive) && styles.disabled]}><Ionicons name="add" size={17} color={colors.paper} /></Pressable>
          </View>
        </View>
        <View style={styles.focusQuickRow}>{[5, 10, 20].map((target) => <Pressable key={target} disabled={focusActive} accessibilityRole="button" accessibilityState={{ selected: repeatSettings.focusTarget === target }} onPress={() => setFocusTarget(target)} style={[styles.focusQuick, repeatSettings.focusTarget === target && styles.focusQuickSelected, focusActive && styles.disabled]}><Text style={[styles.focusQuickText, repeatSettings.focusTarget === target && styles.focusQuickTextSelected]}>{formatArabicCount(target)} عدّات</Text></Pressable>)}</View>
        {focusActive ? (
          <View style={styles.sessionProgressCard}>
            <View style={styles.sessionStatusRow}><View style={styles.sessionDot} /><Text style={styles.sessionStatus}>الجلسة نشطة · الذكر {formatArabicCount(focusIndex + 1)} من {formatArabicCount(focusQueue.length)}</Text></View>
            <Text style={styles.sessionCount}>{formatArabicCount(focusProgress)} / {formatArabicCount(repeatSettings.focusTarget)}</Text>
            <View style={styles.sessionTrack}><View style={[styles.sessionFill, { width: `${Math.min(100, Math.round((focusProgress / repeatSettings.focusTarget) * 100))}%` }]} /></View>
            <Text style={styles.sessionHint}>تتقدم الجلسة تلقائيًا بعد إتمام العدد، حتى لو كانت ضغطة التكرار أكثر.</Text>
          </View>
        ) : null}
        <View style={styles.focusActionRow}>
          <Pressable accessibilityRole="button" disabled={focusActive || filteredItems.length === 0} onPress={beginFocusSession} style={[styles.focusStartButton, (focusActive || filteredItems.length === 0) && styles.disabled]}>
            <Ionicons name="play" size={16} color={colors.ink} /><Text style={styles.focusStartText}>{focusActive ? 'الجلسة مستمرة' : 'ابدأ جلسة التركيز'}</Text>
          </Pressable>
          {focusActive ? <Pressable accessibilityRole="button" onPress={stopFocusSession} style={styles.focusStopButton}><Text style={styles.focusStopText}>إنهاء</Text></Pressable> : null}
        </View>
        {focusStatus ? <Text accessibilityLiveRegion="polite" style={styles.focusStatus}>{focusStatus}</Text> : null}
      </View>

      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel="تصحيح العداد بإنقاص مرة واحدة" disabled={!hydrated || count === 0 || focusActive} onPress={removeOne} style={({ pressed }) => [styles.actionButton, (!hydrated || count === 0 || focusActive) && styles.disabled, pressed && styles.pressed]}>
          <Ionicons name="remove-outline" size={18} color={colors.tealDark} /><Text style={styles.actionText}>تصحيح −١</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="إعادة عدّاد النص المحدد" disabled={!hydrated || count === 0 || focusActive} onPress={() => setConfirmReset(true)} style={({ pressed }) => [styles.actionButton, (!hydrated || count === 0 || focusActive) && styles.disabled, pressed && styles.pressed]}>
          <Ionicons name="refresh-outline" size={17} color={colors.tealDark} /><Text style={styles.actionText}>إعادة العداد</Text>
        </Pressable>
      </View>
      {confirmReset ? (
        <View style={styles.confirmRow}>
          <Text style={styles.confirmText}>إعادة عدّاد النص المحدد إلى الصفر؟</Text>
          <Pressable accessibilityRole="button" onPress={resetActiveDhikr} style={styles.confirmButton}><Text style={styles.confirmButtonText}>تأكيد</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => setConfirmReset(false)} style={styles.cancelButton}><Text style={styles.cancelButtonText}>إلغاء</Text></Pressable>
        </View>
      ) : null}
      {storageError ? <Text style={styles.errorText}>تعذر حفظ الإعدادات والعدادات على هذا الجهاز.</Text> : null}
      {!hydrated ? <ActivityIndicator style={styles.spinner} size="small" color={colors.tealDark} /> : null}
    </SurfaceCard>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    headerIcon: { width: 48, height: 48, borderRadius: 17, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center' },
    headerCopy: { flex: 1 },
    brandEyebrow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    brandEyebrowText: { ...typography.label, color: colors.tealDark, letterSpacing: 1.2, fontSize: 9 },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.teal },
    title: { ...typography.label, color: colors.ink, marginTop: 3 },
    detail: { ...typography.body, color: colors.inkMuted, marginTop: 4 },
    featureRibbon: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: spacing.md, padding: spacing.sm, borderRadius: radii.md, backgroundColor: colors.tealSoft },
    ribbonIcon: { width: 25, height: 25, borderRadius: 9, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
    ribbonText: { ...typography.body, color: colors.tealDark, fontSize: 10, flex: 1 },
    searchInput: { ...typography.body, color: colors.ink, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, marginTop: spacing.md, backgroundColor: colors.paper },
    categoryList: { gap: spacing.xs, paddingVertical: spacing.sm },
    categoryChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: colors.line, borderRadius: radii.pill, paddingVertical: 7, paddingHorizontal: spacing.sm },
    categoryChipSelected: { backgroundColor: colors.tealDark, borderColor: colors.tealDark },
    categoryText: { ...typography.label, color: colors.inkMuted, fontSize: 10 },
    categoryTextSelected: { color: colors.paper },
    resultCount: { ...typography.body, color: colors.inkFaint, fontSize: 11, marginBottom: spacing.xs },
    itemList: { gap: spacing.xs },
    itemRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
    itemRowSelected: { borderColor: colors.tealDark, backgroundColor: colors.tealSoft },
    itemSelect: { flex: 1, paddingVertical: 3 },
    itemText: { ...typography.body, color: colors.ink, textAlign: 'right', lineHeight: 24 },
    itemTextSelected: { color: colors.tealDark },
    itemCategory: { ...typography.body, color: colors.inkFaint, fontSize: 10, marginTop: 3 },
    favoriteButton: { minWidth: 36, minHeight: 38, alignItems: 'center', justifyContent: 'center', marginLeft: spacing.xs },
    emptyText: { ...typography.body, color: colors.inkMuted, paddingVertical: spacing.md, textAlign: 'center' },
    moreButton: { alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, paddingVertical: spacing.sm, marginTop: spacing.xs },
    moreButtonText: { ...typography.label, color: colors.tealDark, fontSize: 11 },
    selectedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.lg },
    selectedLabel: { ...typography.label, color: colors.inkMuted },
    goalText: { ...typography.body, color: colors.inkMuted, fontSize: 10, marginTop: 3 },
    progressBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.tealSoft, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 6 },
    progressBadgeText: { ...typography.label, color: colors.tealDark, fontSize: 11 },
    noteText: { ...typography.body, color: colors.ink, fontSize: 11, lineHeight: 19, marginTop: spacing.xs, backgroundColor: colors.amberSoft, padding: spacing.sm, borderRadius: radii.sm },
    sourceText: { ...typography.body, color: colors.inkFaint, fontSize: 10, lineHeight: 16, marginTop: spacing.xs },
    dhikrText: { ...typography.h2, color: colors.ink, textAlign: 'center', lineHeight: 34, marginTop: spacing.md },
    counterStage: { minHeight: 246, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
    counterOrbit: { position: 'absolute', width: 230, height: 230, borderRadius: 115, borderWidth: 1, borderColor: colors.line, opacity: 0.8 },
    counterOrbitInner: { position: 'absolute', width: 202, height: 202, borderRadius: 101, borderWidth: 1, borderColor: colors.tealSoft },
    orbitSparkOne: { position: 'absolute', top: 26, right: '24%' },
    orbitSparkTwo: { position: 'absolute', bottom: 35, left: '24%' },
    counterButton: { width: 176, height: 176, borderRadius: 88, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', padding: spacing.md, borderWidth: 5, borderColor: colors.tealDark, shadowColor: colors.tealDark, shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
    counterPressed: { transform: [{ scale: 0.97 }], opacity: 0.92 },
    counterTopLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    counterLiveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.amber },
    counterEyebrow: { ...typography.label, color: '#9AE7DB', fontSize: 10 },
    counterValue: { ...typography.display, color: colors.paper, fontSize: 41, lineHeight: 56, marginVertical: 3 },
    counterCaption: { ...typography.label, color: '#C7DDDA', fontSize: 10, textAlign: 'center' },
    progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs, gap: spacing.sm },
    progressLabel: { ...typography.label, color: colors.inkMuted },
    progressValue: { ...typography.label, color: colors.tealDark, fontSize: 11 },
    progressTrack: { height: 8, borderRadius: radii.pill, backgroundColor: colors.tealSoft, overflow: 'hidden', marginTop: spacing.xs },
    progressFill: { height: '100%', backgroundColor: colors.tealDark, borderRadius: radii.pill },
    repeatPanel: { marginTop: spacing.lg, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
    panelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    panelTitle: { ...typography.label, color: colors.ink },
    panelHint: { ...typography.body, color: colors.inkMuted, fontSize: 11, marginTop: 5 },
    scopeRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },
    scopeButton: { flex: 1, alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, paddingVertical: spacing.xs },
    scopeButtonSelected: { borderColor: colors.tealDark, backgroundColor: colors.tealSoft },
    scopeText: { ...typography.label, color: colors.inkMuted, fontSize: 11 },
    scopeTextSelected: { color: colors.tealDark },
    stepPickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md, marginTop: spacing.md },
    stepButton: { width: 42, height: 42, borderRadius: 15, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
    stepValueBox: { alignItems: 'center', minWidth: 110 },
    stepValue: { ...typography.display, color: colors.tealDark, fontSize: 28, lineHeight: 35 },
    stepValueCaption: { ...typography.body, color: colors.inkMuted, fontSize: 10 },
    quickStepRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.sm },
    quickStep: { minWidth: 45, alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: radii.pill, paddingVertical: 6, paddingHorizontal: 8 },
    quickStepSelected: { borderColor: colors.tealDark, backgroundColor: colors.tealDark },
    quickStepText: { ...typography.label, color: colors.inkMuted, fontSize: 10 },
    quickStepTextSelected: { color: colors.paper },
    customStepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line },
    customStepLabel: { ...typography.body, color: colors.inkMuted, fontSize: 10 },
    customStepInput: { ...typography.label, width: 70, minHeight: 38, color: colors.ink, borderWidth: 1, borderColor: colors.line, borderRadius: radii.sm, backgroundColor: colors.paper },
    focusPanel: { marginTop: spacing.md, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.ink, overflow: 'hidden' },
    focusHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    focusIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.tealDark, alignItems: 'center', justifyContent: 'center' },
    focusCopy: { flex: 1 },
    focusTitle: { ...typography.label, color: colors.paper },
    focusDetail: { ...typography.body, color: '#A9C5C1', fontSize: 10, marginTop: 3 },
    focusSetupRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.md },
    focusSettingLabel: { ...typography.label, color: '#E8F3F1', fontSize: 11 },
    focusSettingHint: { ...typography.body, color: '#A9C5C1', fontSize: 9, marginTop: 3 },
    focusStepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    focusStepButton: { width: 31, height: 31, borderRadius: 11, backgroundColor: '#284850', alignItems: 'center', justifyContent: 'center' },
    focusStepValue: { ...typography.h2, color: colors.paper, minWidth: 26, textAlign: 'center' },
    focusQuickRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },
    focusQuick: { flex: 1, alignItems: 'center', borderWidth: 1, borderColor: '#38565C', borderRadius: radii.sm, paddingVertical: 7 },
    focusQuickSelected: { backgroundColor: colors.tealDark, borderColor: colors.tealDark },
    focusQuickText: { ...typography.label, color: '#C4D6D4', fontSize: 10 },
    focusQuickTextSelected: { color: colors.paper },
    sessionProgressCard: { marginTop: spacing.md, padding: spacing.sm, borderRadius: radii.md, backgroundColor: '#132F36' },
    sessionStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    sessionDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#68D6B4' },
    sessionStatus: { ...typography.label, color: '#D4EBE5', fontSize: 10 },
    sessionCount: { ...typography.h2, color: colors.paper, fontSize: 18, marginTop: spacing.xs },
    sessionTrack: { height: 5, borderRadius: radii.pill, backgroundColor: '#31515A', overflow: 'hidden', marginTop: 5 },
    sessionFill: { height: '100%', backgroundColor: '#79DBC2', borderRadius: radii.pill },
    sessionHint: { ...typography.body, color: '#A9C5C1', fontSize: 9, lineHeight: 15, marginTop: 5 },
    focusActionRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md },
    focusStartButton: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radii.md, backgroundColor: '#9AE7DB' },
    focusStartText: { ...typography.label, color: colors.ink, fontSize: 11 },
    focusStopButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radii.md, backgroundColor: '#284850' },
    focusStopText: { ...typography.label, color: colors.paper, fontSize: 11 },
    focusStatus: { ...typography.body, color: '#A9C5C1', fontSize: 10, lineHeight: 16, marginTop: spacing.xs },
    actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
    actionButton: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, paddingHorizontal: spacing.xs },
    actionText: { ...typography.label, color: colors.tealDark, fontSize: 11 },
    confirmRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md },
    confirmText: { ...typography.body, color: colors.ink, flexGrow: 1, flexBasis: '100%' },
    confirmButton: { borderRadius: radii.md, backgroundColor: colors.tealDark, paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
    confirmButtonText: { ...typography.label, color: colors.paper },
    cancelButton: { borderRadius: radii.md, backgroundColor: colors.surface, paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
    cancelButtonText: { ...typography.label, color: colors.inkMuted },
    disabled: { opacity: 0.45 },
    pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
    errorText: { ...typography.body, color: colors.danger, marginTop: spacing.sm },
    spinner: { marginTop: spacing.sm },
  });
}
