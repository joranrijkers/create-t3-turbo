import * as ImagePicker from "expo-image-picker";
import { useCallback, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { useCurrentHousehold } from "~/hooks/useCurrentHousehold";
import { trpc } from "~/utils/api";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export function useRecipeImageUpload(): {
  pickAndUpload: () => Promise<string | null>;
  isUploading: boolean;
  error: string | null;
} {
  const { householdId } = useCurrentHousehold();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getUploadUrl = useMutation(trpc.recipe.getRecipeImageUploadUrl.mutationOptions());

  const pickAndUpload = useCallback(async (): Promise<string | null> => {
    if (!householdId) return null;
    setError(null);
    setIsUploading(true);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        setError("Toegang tot foto's is nodig om een receptfoto toe te voegen.");
        return null;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [16, 10],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]) {
        return null;
      }

      const asset = result.assets[0];
      const uri = asset.uri;
      if (!uri) return null;

      if (asset.fileSize && asset.fileSize > MAX_SIZE_BYTES) {
        setError("Kies een foto kleiner dan 5MB.");
        return null;
      }

      const { uploadUrl, publicUrl } = await getUploadUrl.mutateAsync({
        householdId,
      });

      const response = await fetch(uri);
      const blob = await response.blob();

      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: blob,
        headers: {
          "Content-Type": "image/jpeg",
        },
      });

      if (!uploadResponse.ok) {
        setError("Upload mislukt. Probeer het opnieuw.");
        return null;
      }

      return publicUrl;
    } catch {
      setError("Er ging iets mis bij het uploaden.");
      return null;
    } finally {
      setIsUploading(false);
    }
  }, [householdId, getUploadUrl]);

  return { pickAndUpload, isUploading, error };
}
