import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import { RuqaaText as Text } from '../components/RuqaaText';
import { SurfaceCard } from '../components/SurfaceCard';
import { useAppTheme } from '../theme/ThemeProvider';
import { radii, spacing, typography } from '../theme';
import { MurshidTabIcon } from './MurshidTabIcon';
import { AppTabName, useTabPreferences } from './TabPreferences';

const ROW_HEIGHT = 70;
const TAB_LABELS: Record<AppTabName, string> = {
  الرئيسية: 'الرئيسية',
  'مُرشد AI': 'مُرشد AI',
  'القناة الرسمية': 'القناة الرسمية',
  الرسائل: 'الرسائل',
  المتصفح: 'المتصفح',
  المعرض: 'المعرض',
  الذاكرة: 'الذاكرة',
  المميزات: 'المميزات',
  الإعدادات: 'الإعدادات',
};

export function TabOrderEditor() {
  const { colors } = useAppTheme();
  const { tabOrder, moveTab } = useTabPreferences();
  const [draggingTab, setDraggingTab] = useState<AppTabName | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  return (
    <SurfaceCard>
      <Text style={{ ...typography.h2, color: colors.ink }}>ترتيب الشريط السفلي</Text>
      <Text style={{ ...typography.body, color: colors.inkMuted, marginTop: spacing.xs, marginBottom: spacing.sm }}>
        اسحب المقبض لترتيب الصفحات كما تحب. الرئيسية ثابتة في أول الشريط.
      </Text>
      <View accessibilityRole="list" accessibilityLabel="ترتيب صفحات الشريط السفلي" style={{ gap: spacing.xs }}>
        {tabOrder.map((tab, index) => (
          <DraggableTabRow
            key={tab}
            tab={tab}
            index={index}
            total={tabOrder.length}
            isDragging={draggingTab === tab}
            dragOffset={draggingTab === tab ? dragOffset : 0}
            onDragStart={() => { setDraggingTab(tab); setDragOffset(0); }}
            onDrag={(offset) => setDragOffset(offset)}
            onDragEnd={(offset) => {
              if (tab !== 'الرئيسية') moveTab(tab, index + Math.round(offset / ROW_HEIGHT));
              setDraggingTab(null);
              setDragOffset(0);
            }}
          />
        ))}
      </View>
    </SurfaceCard>
  );
}

function DraggableTabRow({
  tab,
  index,
  total,
  isDragging,
  dragOffset,
  onDragStart,
  onDrag,
  onDragEnd,
}: {
  tab: AppTabName;
  index: number;
  total: number;
  isDragging: boolean;
  dragOffset: number;
  onDragStart: () => void;
  onDrag: (offset: number) => void;
  onDragEnd: (offset: number) => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => StyleSheet.create({
    row: { minHeight: ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, backgroundColor: colors.paper },
    dragged: { borderColor: colors.teal, backgroundColor: colors.tealSoft, zIndex: 5, elevation: 6 },
    copy: { flex: 1 },
    title: { ...typography.label, color: colors.ink },
    subtitle: { ...typography.body, color: colors.inkMuted, fontSize: 11, marginTop: 1 },
    grip: { width: 42, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  }), [colors]);
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_event, gesture) => tab !== 'الرئيسية' && Math.abs(gesture.dy) > 5 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderGrant: () => onDragStart(),
    onPanResponderMove: (_event, gesture) => onDrag(gesture.dy),
    onPanResponderRelease: (_event, gesture) => onDragEnd(gesture.dy),
    onPanResponderTerminate: () => onDragEnd(0),
  }), [tab, onDragStart, onDrag, onDragEnd]);
  const targetIndex = Math.max(1, Math.min(total - 1, index + Math.round(dragOffset / ROW_HEIGHT)));

  return (
    <View style={[styles.row, isDragging && styles.dragged, isDragging && { transform: [{ translateY: dragOffset }] }]} accessible accessibilityLabel={`${TAB_LABELS[tab]}, الموضع ${index + 1}`}>
      <MurshidTabIcon name={tab} size={36} active={isDragging} />
      <View style={styles.copy}>
        <Text style={styles.title}>{TAB_LABELS[tab]}</Text>
        <Text style={styles.subtitle}>{tab === 'الرئيسية' ? 'مثبّتة في بداية الشريط' : isDragging && targetIndex !== index ? `ستنتقل إلى الموضع ${targetIndex + 1}` : `الموضع ${index + 1}`}</Text>
      </View>
      {tab === 'الرئيسية'
        ? <View style={styles.grip} accessibilityLabel="الرئيسية ثابتة"><Ionicons name="lock-closed-outline" size={19} color={colors.inkFaint} /></View>
        : <View {...panResponder.panHandlers} style={styles.grip} accessibilityRole="adjustable" accessibilityLabel={`اسحب لترتيب ${TAB_LABELS[tab]}`}>
          <Ionicons name="reorder-three-outline" size={24} color={isDragging ? colors.tealDark : colors.inkMuted} />
        </View>}
    </View>
  );
}
