import * as ImagePicker from "expo-image-picker";
import { useCallback, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { trpc } from "~/utils/api";
import { authClient } from "~/utils/auth";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

function withCacheBuster(url: string): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${Date.now()}`;
}

export function useProfileImageUpload(): {
  pickAndUpload: () => Promise<void>;
  isUploading: boolean;
  error: string | null;
  previewImageUri: string | null;
} {
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);

  const getUploadUrl = useMutation(trpc.auth.getProfileImageUploadUrl.mutationOptions());
  const setProfileImage = useMutation(
    trpc.auth.setProfileImage.mutationOptions({
      onSuccess: (_data, variables) => {
        const nextImageUrl = withCacheBuster(variables.imageUrl);
        queryClient.setQueriesData(
          { predicate: (q) => q.queryKey[0] === "session" },
          (current) => {
            if (!current || typeof current !== "object") return current;
            const sessionData = current as { user?: { image?: string } };
            if (!sessionData.user) return current;
            return {
              ...sessionData,
              user: {
                ...sessionData.user,
                image: nextImageUrl,
              },
            };
          },
        );
        queryClient.invalidateQueries({
          predicate: (q) => {
            const k = q.queryKey;
            if (!Array.isArray(k) || !Array.isArray(k[0])) return false;
            const first = k[0] as string[];
            return first[0] === "household" && first[1] === "members";
          },
        });
      },
    }),
  );

  const pickAndUpload = useCallback(async (): Promise<void> => {
    setError(null);
    setIsUploading(true);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        setError("Toegang tot foto's is nodig om een profielfoto te kiezen.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const asset = result.assets[0];
      const uri = asset.uri;
      if (!uri) return;
      setPreviewImageUri(uri);

      if (asset.fileSize && asset.fileSize > MAX_SIZE_BYTES) {
        setError("Kies een foto kleiner dan 5MB.");
        return;
      }

      const { uploadUrl, publicUrl } = await getUploadUrl.mutateAsync();

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
        return;
      }

      const nextImageUrl = withCacheBuster(publicUrl);
      await setProfileImage.mutateAsync({ imageUrl: publicUrl });
      setPreviewImageUri(nextImageUrl);
      const client = authClient as unknown as {
        getSession?: (args?: unknown) => Promise<unknown>;
        $store?: { notify?: (signal: string) => void };
      };
      await client.getSession?.({
        query: {
          disableCookieCache: true,
        },
      });
      client.$store?.notify?.("$sessionSignal");
    } catch {
      setError("Er ging iets mis bij het uploaden.");
    } finally {
      setIsUploading(false);
    }
  }, [getUploadUrl, setProfileImage]);

  return { pickAndUpload, isUploading, error, previewImageUri };
}
