import {
  View, Text, StyleSheet, TextInput, Pressable, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "~/hooks/useAppTheme";
import { trpc } from "~/utils/api";
import { useRecipeImageUpload } from "~/hooks/useRecipeImageUpload";
import { UnitPicker } from "~/components/UnitPicker";
import { toCanonicalUnit } from "~/utils/canonical-units";

const SCREEN_PADDING = 20;
const CARD_RADIUS = 16;

const DIET_TAGS = [
  { value: "Vegetarisch", labelKey: "recipes.tagVegetarian" as const },
  { value: "Vegan", labelKey: "recipes.tagVegan" as const },
  { value: "Glutenvrij", labelKey: "recipes.tagGlutenFree" as const },
  { value: "Lactosevrij", labelKey: "recipes.tagLactoseFree" as const },
  { value: "Keto", labelKey: "recipes.tagKeto" as const },
];
const LABEL_TAGS = [
  { value: "Snel < 30 min", labelKey: "recipes.labelQuick" as const },
  { value: "Pasta", labelKey: "recipes.labelPasta" as const },
  { value: "Aziatisch", labelKey: "recipes.labelAsian" as const },
  { value: "Italiaans", labelKey: "recipes.labelItalian" as const },
  { value: "Soep", labelKey: "recipes.labelSoup" as const },
  { value: "Bakken", labelKey: "recipes.labelBaking" as const },
  { value: "Grill", labelKey: "recipes.labelGrill" as const },
];

type EditIngredient = {
  localId: string;
  id?: string;
  name: string;
  amount: string;
  unit: string;
  isNew?: boolean;
  isDeleted?: boolean;
};
type Step = { id: string; text: string };

export default function EditReceptScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipeId = id ?? "";

  const [title, setTitle] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [prepTime, setPrepTime] = useState("30");
  const [servings, setServings] = useState(4);
  const [ingredients, setIngredients] = useState<EditIngredient[]>([]);
  const [steps, setSteps] = useState<Step[]>([{ id: "1", text: "" }]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState(false);

  const { pickAndUpload, isUploading } = useRecipeImageUpload();

  const recipeQuery = useQuery({
    ...trpc.recipe.byId.queryOptions({ id: recipeId }),
    enabled: !!recipeId,
  });

  useEffect(() => {
    if (prefilled || !recipeQuery.data) return;
    const { recipe, ingredients: dbIngredients } = recipeQuery.data;

    setTitle(recipe.title ?? "");
    setPrepTime(String(recipe.prepTimeMinutes ?? 30));
    setServings(recipe.servings ?? 4);
    setImageUrl(recipe.imageUrl ?? null);

    const allTags = recipe.tags ?? [];
    setSelectedTags(allTags.filter((t) => DIET_TAGS.map((d) => d.value.toLowerCase()).includes(t.toLowerCase())));
    setSelectedLabels(allTags.filter((t) => LABEL_TAGS.map((l) => l.value.toLowerCase()).includes(t.toLowerCase())));

    const instr = recipe.instructions ?? [];
    setSteps(
      instr.length > 0
        ? instr.map((item, i) => ({
            id: String(i),
            text: typeof item === "string" ? item : (item as { text: string }).text ?? "",
          }))
        : [{ id: "1", text: "" }]
    );

    setIngredients(
      dbIngredients.map((ing) => ({
        localId: ing.id,
        id: ing.id,
        name: ing.name,
        amount: ing.amount ?? "",
        unit: ing.unit ?? "",
      }))
    );

    setPrefilled(true);
  }, [recipeQuery.data, prefilled]);

  const updateMutation = useMutation({ ...trpc.recipe.update.mutationOptions() });
  const ingredientCreateMutation = useMutation({ ...trpc.ingredient.create.mutationOptions() });
  const ingredientDeleteMutation = useMutation({ ...trpc.ingredient.delete.mutationOptions() });

  const handleImagePress = async () => {
    const url = await pickAndUpload();
    if (url) setImageUrl(url);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  };
  const toggleLabel = (label: string) => {
    setSelectedLabels((prev) => prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]);
  };

  const addIngredient = () => {
    setIngredients((prev) => [...prev, { localId: Date.now().toString(), name: "", amount: "", unit: "", isNew: true }]);
  };
  const removeIngredient = (localId: string) => {
    setIngredients((prev) =>
      prev.map((ing) =>
        ing.localId === localId
          ? ing.id
            ? { ...ing, isDeleted: true }
            : { ...ing, isDeleted: true }
          : ing
      ).filter((ing) => !(ing.isDeleted && !ing.id))
    );
  };
  const updateIngredient = (localId: string, field: keyof EditIngredient, value: string) => {
    setIngredients((prev) => prev.map((i) => i.localId === localId ? { ...i, [field]: value } : i));
  };

  const addStep = () => {
    setSteps((prev) => [...prev, { id: Date.now().toString(), text: "" }]);
  };
  const removeStep = (id: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== id));
  };
  const updateStep = (id: string, text: string) => {
    setSteps((prev) => prev.map((s) => s.id === id ? { ...s, text } : s));
  };

  const isPending = updateMutation.isPending || ingredientCreateMutation.isPending || ingredientDeleteMutation.isPending;

  const handleSubmit = async () => {
    if (!title.trim()) { setError(t("recipes.recipeNameRequired")); return; }
    setError(null);

    const validSteps = steps
      .filter((s) => s.text.trim())
      .map((s, i) => ({ step: i + 1, text: s.text.trim() }));
    const prepTimeNum = parseInt(prepTime, 10);

    try {
      await updateMutation.mutateAsync({
        id: recipeId,
        title: title.trim(),
        tags: [...selectedTags, ...selectedLabels],
        prepTimeMinutes: Number.isNaN(prepTimeNum) ? undefined : prepTimeNum,
        servings,
        instructions: validSteps,
        imageUrl: imageUrl ?? undefined,
      });

      for (const ing of ingredients) {
        if (ing.id && ing.isDeleted) {
          await ingredientDeleteMutation.mutateAsync({ id: ing.id });
        }
      }

      for (const ing of ingredients) {
        if (ing.isNew && !ing.isDeleted && ing.name.trim()) {
          await ingredientCreateMutation.mutateAsync({
            recipeId: recipeId,
            name: ing.name.trim(),
            amount: ing.amount || undefined,
            unit: toCanonicalUnit(ing.unit) || undefined,
          });
        }
      }

      router.back();
    } catch {
      setError(t("recipes.saveError"));
    }
  };

  if (recipeQuery.isPending) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (recipeQuery.error) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: colors.text }]}>{t("recipes.recipeNotFound")}</Text>
          <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.surfaceVariant }]}>
            <Text style={{ color: colors.text, fontWeight: "600" }}>{t("common.goBack")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const visibleIngredients = ingredients.filter((i) => !i.isDeleted);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()} style={styles.headerBack}>
            <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t("recipes.editRecipe")}</Text>
          <Pressable onPress={() => void handleSubmit()} style={styles.headerSave} disabled={isPending}>
            {isPending
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Text style={[styles.headerSaveText, { color: colors.primary }]} numberOfLines={1}>{t("recipes.save")}</Text>
            }
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingHorizontal: SCREEN_PADDING }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Image upload */}
          {imageUrl && !isUploading ? (
            <Pressable style={styles.imagePreviewWrap} onPress={() => void handleImagePress()}>
              <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
              <View style={styles.imageEditOverlay}>
                <MaterialCommunityIcons name="camera-outline" size={20} color="#FFFFFF" />
                <Text style={styles.imageEditText}>{t("settings.changePhoto")}</Text>
              </View>
            </Pressable>
          ) : (
            <Pressable style={[styles.imageUpload, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => void handleImagePress()}>
              {isUploading ? (
                <ActivityIndicator size="large" color={colors.primary} />
              ) : (
                <>
                  <View style={[styles.imageIcon, { backgroundColor: "#FFF0E8" }]}>
                    <MaterialCommunityIcons name="image-outline" size={28} color={colors.primary} />
                  </View>
                  <Text style={[styles.imageTitle, { color: colors.text }]}>{t("recipes.coverPhoto")}</Text>
                  <Text style={[styles.imageSubtitle, { color: colors.textMuted }]}>{t("recipes.coverPhotoHint")}</Text>
                </>
              )}
            </Pressable>
          )}

          {/* Basisinfo */}
          <Text style={[styles.sectionHeader, { color: colors.text }]}>{t("recipes.basicInfo")}</Text>

          <Text style={[styles.label, { color: colors.text }]}>{t("recipes.recipeName")}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            placeholder={t("recipes.recipeNamePlaceholder")}
            placeholderTextColor={colors.textMuted}
            value={title}
            onChangeText={setTitle}
          />

          <Text style={[styles.label, { color: colors.text }]}>{t("recipes.tags")}</Text>
          <View style={styles.tagsRow}>
            {DIET_TAGS.map((tag) => {
              const selected = selectedTags.map((t) => t.toLowerCase()).includes(tag.value.toLowerCase());
              return (
                <Pressable
                  key={tag.value}
                  style={[styles.tagChip, selected
                    ? { backgroundColor: "#FFF0E8", borderColor: colors.primary, borderWidth: 1 }
                    : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }
                  ]}
                  onPress={() => toggleTag(tag.value)}
                >
                  <Text style={[styles.tagChipText, { color: selected ? colors.primary : colors.textMuted }]}>{t(tag.labelKey)}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { color: colors.text }]}>{t("recipes.labelSection")}</Text>
          <View style={styles.tagsRow}>
            {LABEL_TAGS.map((label) => {
              const selected = selectedLabels.map((l) => l.toLowerCase()).includes(label.value.toLowerCase());
              return (
                <Pressable
                  key={label.value}
                  style={[styles.tagChip, selected
                    ? { backgroundColor: "#FFF0E8", borderColor: colors.primary, borderWidth: 1 }
                    : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }
                  ]}
                  onPress={() => toggleLabel(label.value)}
                >
                  <Text style={[styles.tagChipText, { color: selected ? colors.primary : colors.textMuted }]}>{t(label.labelKey)}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.twoColumns}>
            <View style={styles.column}>
              <Text style={[styles.label, { color: colors.text }]}>{t("recipes.prepTimeLabel")}</Text>
              <View style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, justifyContent: "center" }]}>
                <TextInput
                  style={[styles.inlineInput, { color: colors.text }]}
                  value={prepTime}
                  onChangeText={setPrepTime}
                  keyboardType="number-pad"
                  placeholder="30"
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={[styles.inputSuffix, { color: colors.textMuted }]}>{t("recipes.minutesLabel")}</Text>
              </View>
            </View>
            <View style={styles.column}>
              <Text style={[styles.label, { color: colors.text }]}>{t("recipes.servingsLabel")}</Text>
              <View style={[styles.stepperRow, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: CARD_RADIUS }]}>
                <Pressable style={styles.stepperBtn} onPress={() => setServings((v) => Math.max(1, v - 1))}>
                  <Text style={[styles.stepperBtnText, { color: colors.text }]}>−</Text>
                </Pressable>
                <Text style={[styles.stepperValue, { color: colors.text }]}>{servings}</Text>
                <Pressable style={styles.stepperBtn} onPress={() => setServings((v) => v + 1)}>
                  <Text style={[styles.stepperBtnText, { color: colors.primary }]}>+</Text>
                </Pressable>
              </View>
            </View>
          </View>

          {error && <Text style={[styles.fieldError, { color: "#C62828" }]}>{error}</Text>}

          {/* Ingrediënten */}
          <View style={styles.sectionTitleRow}>
            <Text style={[styles.sectionHeader, { color: colors.text, marginBottom: 0 }]}>{t("recipes.ingredients")}</Text>
            <Text style={[styles.sectionMeta, { color: colors.textMuted }]}>{servings} {t("recipes.servings")}</Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card }]}>
            {visibleIngredients.map((ing, idx) => (
              <View key={ing.localId} style={[styles.ingredientRow, idx < visibleIngredients.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                <View style={[styles.ingredientDot, { backgroundColor: colors.primary }]} />
                <TextInput
                  style={[styles.ingredientNameInput, { color: colors.text }]}
                  placeholder={t("recipes.ingredientPlaceholder")}
                  placeholderTextColor={colors.textMuted}
                  value={ing.name}
                  onChangeText={(v) => updateIngredient(ing.localId, "name", v)}
                />
                <TextInput
                  style={[styles.ingredientAmountInput, { color: colors.text }]}
                  placeholder="400"
                  placeholderTextColor={colors.textMuted}
                  value={ing.amount}
                  onChangeText={(v) => updateIngredient(ing.localId, "amount", v)}
                  keyboardType="decimal-pad"
                />
                <UnitPicker
                  value={ing.unit}
                  onChange={(u) => updateIngredient(ing.localId, "unit", u)}
                />
                <Pressable onPress={() => removeIngredient(ing.localId)} style={styles.removeBtn}>
                  <MaterialCommunityIcons name="minus" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            ))}
            <Pressable style={styles.addRow} onPress={addIngredient}>
              <MaterialCommunityIcons name="plus" size={18} color={colors.primary} />
              <Text style={[styles.addRowText, { color: colors.primary }]}>{t("recipes.addIngredient")}</Text>
            </Pressable>
          </View>

          {/* Bereidingsstappen */}
          <Text style={[styles.sectionHeader, { color: colors.text }]}>{t("recipes.instructionsStepsLabel")}</Text>

          <View style={[styles.card, { backgroundColor: colors.card }]}>
            {steps.map((step, idx) => (
              <View key={step.id} style={[styles.stepRow, idx < steps.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
                  <Text style={styles.stepNumberText}>{idx + 1}</Text>
                </View>
                <TextInput
                  style={[styles.stepInput, { color: colors.text }]}
                  placeholder={t("recipes.stepPlaceholder")}
                  placeholderTextColor={colors.textMuted}
                  value={step.text}
                  onChangeText={(v) => updateStep(step.id, v)}
                  multiline
                />
                <Pressable onPress={() => removeStep(step.id)} style={styles.removeBtn}>
                  <MaterialCommunityIcons name="minus" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            ))}
            <Pressable style={styles.addRow} onPress={addStep}>
              <MaterialCommunityIcons name="plus" size={18} color={colors.primary} />
              <Text style={[styles.addRowText, { color: colors.primary }]}>{t("recipes.addStep")}</Text>
            </Pressable>
          </View>

          {/* Submit */}
          <Pressable
            style={[styles.submitButton, { backgroundColor: colors.primary }, isPending && { opacity: 0.7 }]}
            onPress={() => void handleSubmit()}
            disabled={isPending}
          >
            {isPending
              ? <ActivityIndicator color="#FFFFFF" />
              : <>
                  <MaterialCommunityIcons name="content-save-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.submitButtonText}>{t("recipes.save")}</Text>
                </>
            }
          </Pressable>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  keyboard: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 12, borderBottomWidth: 1 },
  headerBack: { padding: 8, width: 44 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "700", textAlign: "center" },
  headerSave: { padding: 8, minWidth: 70, alignItems: "flex-end" },
  headerSaveText: { fontSize: 16, fontWeight: "600", flexShrink: 0 },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 20, paddingBottom: 32 },
  imageUpload: {
    alignItems: "center", paddingVertical: 28, borderRadius: CARD_RADIUS,
    borderWidth: 2, borderStyle: "dashed", marginBottom: 24, gap: 8,
    overflow: "hidden", height: 160,
  },
  imageIcon: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  imageTitle: { fontSize: 16, fontWeight: "600" },
  imageSubtitle: { fontSize: 13 },
  imagePreview: { width: "100%", height: "100%", borderRadius: CARD_RADIUS },
  imagePreviewWrap: { height: 180, borderRadius: CARD_RADIUS, overflow: "hidden", marginBottom: 24, alignItems: "center", justifyContent: "flex-end" },
  imageEditOverlay: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(0,0,0,0.45)", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginBottom: 12 },
  imageEditText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
  sectionHeader: { fontSize: 18, fontWeight: "700", marginBottom: 14, marginTop: 8 },
  sectionTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14, marginTop: 8 },
  sectionMeta: { fontSize: 14 },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 8 },
  input: {
    height: 52, borderRadius: CARD_RADIUS, borderWidth: 1,
    paddingHorizontal: 16, fontSize: 16, marginBottom: 16,
    flexDirection: "row", alignItems: "center",
  },
  inlineInput: { flex: 1, fontSize: 16 },
  inputSuffix: { fontSize: 14 },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  tagChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  tagChipText: { fontSize: 13, fontWeight: "500" },
  twoColumns: { flexDirection: "row", gap: 12, marginBottom: 8 },
  column: { flex: 1 },
  stepperRow: { height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4 },
  stepperBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  stepperBtnText: { fontSize: 24, fontWeight: "600" },
  stepperValue: { fontSize: 18, fontWeight: "700" },
  fieldError: { fontSize: 13, marginBottom: 12 },
  card: { borderRadius: CARD_RADIUS, overflow: "hidden", marginBottom: 8 },
  ingredientRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, gap: 10 },
  ingredientDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  ingredientNameInput: { flex: 1, fontSize: 15 },
  ingredientAmountInput: { width: 80, fontSize: 15, textAlign: "right" },
  removeBtn: { padding: 4, width: 28, alignItems: "center" },
  addRow: { flexDirection: "row", alignItems: "center", padding: 16, gap: 8 },
  addRowText: { fontSize: 15, fontWeight: "500" },
  stepRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 14, paddingHorizontal: 16, gap: 12 },
  stepNumber: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 },
  stepNumberText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  stepInput: { flex: 1, fontSize: 15, lineHeight: 20 },
  submitButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", height: 56, borderRadius: CARD_RADIUS, gap: 8, marginTop: 16 },
  submitButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  bottomSpacer: { height: 24 },
  errorText: { fontSize: 18, fontWeight: "600" },
  backBtn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
});
