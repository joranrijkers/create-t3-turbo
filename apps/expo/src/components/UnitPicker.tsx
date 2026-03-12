import { View, Text, StyleSheet, Pressable, Modal, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "~/hooks/useAppTheme";
import { CANONICAL_UNIT_SLUGS, toCanonicalUnit, type CanonicalUnitSlug } from "~/utils/canonical-units";

type UnitGroup = { labelKey: string; units: CanonicalUnitSlug[] };

const UNIT_GROUPS: UnitGroup[] = [
  { labelKey: "groceries.unitGroupWeight", units: ["g", "kg"] },
  { labelKey: "groceries.unitGroupVolume", units: ["ml", "l"] },
  { labelKey: "groceries.unitGroupSpoons", units: ["tsp", "tbsp", "cup"] },
  { labelKey: "groceries.unitGroupCount", units: ["piece", "slice", "clove", "bunch", "pinch", "can", "package", "bottle", "crate"] },
  { labelKey: "groceries.unitGroupOther", units: ["other"] },
];

interface Props {
  value: string;
  onChange: (unit: string) => void;
}

export function UnitPicker({ value, onChange }: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);

  const canonicalValue = toCanonicalUnit(value);
  const displayLabel = canonicalValue ? t(`units.${canonicalValue}`, { count: 1, defaultValue: canonicalValue }) : t("groceries.unitPlaceholder");

  const handleSelect = (slug: string) => {
    onChange(slug);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        style={[styles.trigger, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}
        onPress={() => setOpen(true)}
      >
        <Text style={[styles.triggerText, { color: canonicalValue ? colors.text : colors.textMuted }]} numberOfLines={1}>
          {displayLabel}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={14} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <Pressable style={styles.overlay} onPress={() => setOpen(false)} />
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>{t("groceries.unitPickerTitle")}</Text>
              <Pressable onPress={() => setOpen(false)}>
                <MaterialCommunityIcons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Pressable
                style={[styles.unitRow, { borderBottomColor: colors.border }, canonicalValue === "" && { backgroundColor: colors.surfaceVariant }]}
                onPress={() => handleSelect("")}
              >
                <Text style={[styles.unitLabel, { color: canonicalValue === "" ? colors.primary : colors.textMuted }]}>
                  {t("groceries.unitNone")}
                </Text>
                {canonicalValue === "" && <MaterialCommunityIcons name="check" size={16} color={colors.primary} />}
              </Pressable>

              {UNIT_GROUPS.map((group) => (
                <View key={group.labelKey}>
                  <Text style={[styles.groupLabel, { color: colors.textMuted, backgroundColor: colors.background }]}>
                    {t(group.labelKey).toUpperCase()}
                  </Text>
                  {group.units.map((slug, idx) => {
                    const isSelected = canonicalValue === slug;
                    return (
                      <Pressable
                        key={slug}
                        style={[
                          styles.unitRow,
                          idx < group.units.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                          isSelected && { backgroundColor: colors.surfaceVariant },
                        ]}
                        onPress={() => handleSelect(slug)}
                      >
                        <Text style={[styles.unitLabel, { color: isSelected ? colors.primary : colors.text }]}>
                          {t(`units.${slug}`, { count: 1, defaultValue: slug })}
                        </Text>
                        {isSelected && <MaterialCommunityIcons name="check" size={16} color={colors.primary} />}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 68,
    maxWidth: 90,
  },
  triggerText: { fontSize: 13, fontWeight: "500", flex: 1 },
  kav: { flex: 1, justifyContent: "flex-end", backgroundColor: "transparent" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "70%" },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
  },
  sheetTitle: { fontSize: 18, fontWeight: "700" },
  groupLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  unitRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  unitLabel: { fontSize: 15 },
});
