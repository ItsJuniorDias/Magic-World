import Card from "@/components/card";
import Text from "@/components/ui/Text";
import { tokens } from "@/constants/tokens";
import { StatusBar } from "expo-status-bar";
import {
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  Animated,
} from "react-native";

import { db } from "../../firebaseConfig";
import React, {
  useEffect,
  useState,
  useMemo,
  useRef,
  useCallback,
} from "react"; // Adicionado useRef
import { useRouter } from "expo-router";
import {
  doc,
  increment,
  updateDoc,
} from "firebase/firestore";
import { useStoriesStore } from "@/store/useStoriesStore";

import { useLikedStore } from "@/store/useLikedStore";

import { useQuery } from "@tanstack/react-query";
import { getStories } from "@/services/getStories";
import CardSkeleton from "@/components/card-skeleton";
import { uploadGeminiToCloudinary } from "@/services/generateURL";

import { useAppReview } from "@/hooks/useAppReview";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useT } from "@/i18n";

// Texto via OpenRouter (services/ai). Imagem continua com
// Gemini direto porque é chamada só pelo seed manual da home
// (a função `generateStory` está comentada no useEffect).
import { generateJSON } from "@/services/ai";
import { GoogleGenerativeAI } from "@google/generative-ai";

const geminiForImages = new GoogleGenerativeAI(
  process.env.EXPO_PUBLIC_GOOGLE_API_KEY || "",
);

const geminiImage = geminiForImages.getGenerativeModel({
  model: "gemini-2.5-flash-image",
});

// --- COMPONENTE DE SEÇÃO MEMORIZADO PARA EVITAR PISQUE ---
const SectionComponent = ({
  title,
  data,
  variant,
  loading,
  onRenderItem, // Alterado o nome para evitar conflito
  likedIds, // Passamos explicitamente para o memo comparar
}: {
  title: string;
  data: any[];
  variant?: "default" | "category" | "recent";
  loading: boolean;
  onRenderItem: any;
  likedIds: string[];
}) => {
  const scrollX = useRef(new Animated.Value(0)).current;

  return (
    <View style={styles.section}>
      <Text
        title={title}
        fontFamily="bold"
        fontSize={24}
        color={tokens.color.dark.textPrimary}
        style={{ marginBottom: tokens.spacing.sm, marginLeft: tokens.spacing.lg }}
      />

      {loading ? (
        <FlatList
          data={[1, 2, 3, 4, 5]}
          renderItem={() => <CardSkeleton variant={variant} />}
          horizontal
          keyExtractor={(item) => item.toString()}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingLeft: 24 }}
        />
      ) : (
        <Animated.FlatList
          data={data}
          renderItem={(info) => onRenderItem({ ...info, variant, scrollX })}
          extraData={likedIds} // Garante atualização apenas se os likes mudarem
          horizontal
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: true },
          )}
          scrollEventThrottle={16}
          initialNumToRender={7}
          maxToRenderPerBatch={5}
          windowSize={5}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingLeft: 24 }}
          removeClippedSubviews={Platform.OS === "android"}
        />
      )}
    </View>
  );
};

// Memoiza a seção: ela só re-renderiza se os dados ou os likes mudarem
const Section = React.memo(SectionComponent, (prev, next) => {
  return (
    prev.loading === next.loading &&
    prev.data === next.data &&
    JSON.stringify(prev.likedIds) === JSON.stringify(next.likedIds)
  );
});

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useT();
  const [generatedStory, setGeneratedStory] = useState<any>(null);
  const { requestReviewOnce } = useAppReview();

  const likedIds = useLikedStore((s) => s.likedIds);
  const toggleLike = useLikedStore((s) => s.toggleLike);
  const loadLikedStories = useLikedStore((s) => s.loadLikedStories);

  const query = useQuery({ queryKey: ["stories"], queryFn: getStories });

  const incrementStoryViews = async (storyId: string) => {
    const storyRef = doc(db, "stories", storyId);
    await updateDoc(storyRef, { views: increment(1) });

    useStoriesStore.setState((state) => ({
      stories: state.stories.map((story) =>
        story.id === storyId
          ? { ...story, views: (story.views ?? 0) + 1 }
          : story,
      ),
    }));
  };

  async function generateStory() {
    // Texto via OpenRouter (services/ai já cuida de retry e parse JSON)
    const story: any = await generateJSON(
      `
Write an original children's saga-style story set in a magical adventure world.

Important character rules:
Each chapter must focus on different main characters (children, creatures, or heroes), with unique personalities, backgrounds, and motivations.
Do not reuse the same protagonist across chapters.
Characters may meet, influence events, or be connected by the same world or legend, but each chapter should feel like a new perspective.

Story guidelines:
Genre: future
Tone: Epic, immersive, mysterious
Style: Saga narrative
Audience: Children
World-building should feel magical, safe, and wondrous
Include discovery, courage, friendship, and mystery
Avoid violence or dark themes unsuitable for children

Narrative focus:
Chapter 1: Introduce the world through the eyes of the first character
Chapter 2: Expand the world with a new character from a different place or culture
Chapter 3: Reveal a deeper secret of the world through a third, unexpected character

Writing rules:
Rich descriptions and sensory details
Clear beginning, middle, and end for each chapter
Maintain continuity of the world while changing protagonists
Generate the story following the exact JSON structure below.

Structure:
{
  "category": "future",
  "title": "",
  "thumbnail": "",
  "views": 0,
  "id": "",
  "isPro": true,
  "chapter": [
    { "locked": false, "navigate": "/(storie)", "storie": "", "title": "", "thumbnail": "" },
    { "locked": true,  "navigate": "/(storie)", "storie": "", "title": "", "thumbnail": "" },
    { "locked": true,  "navigate": "/(storie)", "storie": "", "title": "", "thumbnail": "" }
  ]
}
`,
      { model: "smart", temperature: 0.85 },
    );

    // Upload and set story thumbnail
    const storyImagePrompt = `Cover illustration for a children's mystery saga titled "${story.title}". The scene should be magical, safe, and wondrous, capturing the essence of discovery, courage, friendship, and mystery. Style: vibrant colors, whimsical details, and a touch of fantasy.`;

    const storyImageResult = await geminiImage.generateContent({
      contents: [{ role: "user", parts: [{ text: storyImagePrompt }] }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    });

    const storyImagePart =
      storyImageResult.response.candidates[0].content.parts.find(
        (p) => p.inlineData,
      );

    if (storyImagePart) {
      const permanentUrl = await uploadGeminiToCloudinary(
        storyImagePart.inlineData.data,
      );

      story.thumbnail = permanentUrl;
    }

    // Generate and upload thumbnails for each chapter
    for (let i = 0; i < story.chapter.length; i++) {
      const chapter = story.chapter[i];

      const imagePrompt = `Illustration for the chapter titled "${chapter.title}" in a children's mystery saga. The scene should be magical, safe, and wondrous, capturing the essence of discovery, courage, friendship, and mystery. Style: vibrant colors, whimsical details, and a touch of fantasy.`;

      const result = await geminiImage.generateContent({
        contents: [{ role: "user", parts: [{ text: imagePrompt }] }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      });

      const imagePart = result.response.candidates[0].content.parts.find(
        (p) => p.inlineData,
      );

      if (imagePart) {
        const permanentUrl = await uploadGeminiToCloudinary(
          imagePart.inlineData.data,
        );

        story.chapter[i].thumbnail = permanentUrl;
      }
    }

    return story;
  }

  useEffect(() => {
    const load = async () => {
      try {
        setTimeout(() => {
          requestReviewOnce();
        }, 30000);

        // Seed manual de novas histórias (dev-only):
        // 1. Descomenta as duas linhas abaixo
        // 2. Reinstala `firebase/firestore` addDoc/collection/serverTimestamp
        // 3. Adiciona no import: import { addDoc, collection, serverTimestamp }
        //
        // const story = await generateStory();
        // await addDoc(collection(db, "stories"), { ...story, createdAt: serverTimestamp() });
      } catch (err) {
        console.error(err);
      }
    };
    load();

    loadLikedStories();
  }, []);

  // ✅ CORREÇÃO: renderItem agora é um CALLBACK estável
  const memoizedRenderItem = useCallback(
    ({ item, variant, index, scrollX }: any) => (
      <Card
        variant={variant}
        thumbnail={item.thumbnail}
        title={item.title}
        views={item.views}
        index={index}
        scrollX={scrollX}
        isPro={item.isPro}
        isFavorite={likedIds.includes(item.id)}
        onToggleFavorite={() => {
          toggleLike({
            storyId: item.id,
            title: item.title,
            thumbnail: item.thumbnail,
            chapter: item.chapter,
          });
          // Removido o loadLikedStories() daqui de dentro para evitar ciclos de re-render
        }}
        onPress={async () => {
          if (variant !== "category") {
            await incrementStoryViews(item.id);
          }

          const hasPro = await AsyncStorage.getItem("@user_is_pro");

          if (item.isPro === true && hasPro !== "true") {
            router.push("/(subscribe)");
          } else {
            router.push({
              pathname: item.chapter[0].navigate,
              params: {
                storie: item.chapter[0].storie,
                title: item.chapter[0].title,
                thumbnail: item.chapter[0].thumbnail,
                storyId: item.id,
                currentIndex: 0,
              },
            });
          }
        }}
      />
    ),
    [likedIds], // Só recria a função se a lista de likes mudar
  );

  const mostWatched = useMemo(() => {
    return [...(query.data ?? [])].sort(
      (a, b) => (b.views ?? 0) - (a.views ?? 0),
    );
  }, [query.data]);

  const recentlyPublished = useMemo(() => {
    return [...(query.data ?? [])].sort(
      (a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0),
    );
  }, [query.data]);

  const categoryStories = useMemo(
    () => [
      {
        id: "fantasy",
        title: "Fantasy",
        chapter: [{ navigate: "/(categories-detail)" }],
        thumbnail:
          "https://res.cloudinary.com/dqvujibkn/image/upload/v1769205788/pfwo9imq95av3qlnlqf3.png",
      },
      {
        id: "adventure",
        title: "Adventure",
        chapter: [{ navigate: "/(categories-detail)" }],
        thumbnail:
          "https://res.cloudinary.com/dqvujibkn/image/upload/v1769205676/fqgbiicg2oacp9jfo8ah.png",
      },
      {
        id: "mystery",
        title: "Mystery",
        chapter: [{ navigate: "/(categories-detail)" }],
        thumbnail:
          "https://res.cloudinary.com/dqvujibkn/image/upload/v1769205719/agbq553klppl3upwl3s9.png",
      },
      {
        id: "future",
        title: "Future",
        chapter: [{ navigate: "/(categories-detail)" }],
        thumbnail:
          "https://res.cloudinary.com/dqvujibkn/image/upload/v1769205882/hnv00nh6zqskkjn2saqw.png",
      },
      {
        id: "all",
        title: "All Categories",
        chapter: [{ navigate: "/(categories)" }],
        thumbnail:
          "https://res.cloudinary.com/dqvujibkn/image/upload/v1767753186/Gemini_Generated_Image_mijilhmijilhmiji_1_frh7nh.png",
      },
    ],
    [],
  );

  return (
    <>
      <StatusBar style="light" translucent />
      <ScrollView showsVerticalScrollIndicator={false} style={styles.container}>
        <Section
          title={t("home.mostWatched")}
          data={mostWatched}
          variant="default"
          loading={query.isLoading}
          onRenderItem={memoizedRenderItem}
          likedIds={likedIds}
        />

        <Section
          title={t("home.categoriesSection")}
          data={categoryStories}
          variant="category"
          loading={false}
          onRenderItem={memoizedRenderItem}
          likedIds={likedIds}
        />

        <Section
          title={t("home.recentlyPublished")}
          data={recentlyPublished}
          variant="recent"
          loading={query.isLoading}
          onRenderItem={memoizedRenderItem}
          likedIds={likedIds}
        />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.color.dark.bg,
    paddingTop: Platform.OS === "ios" ? tokens.spacing.xs : tokens.spacing.lg,
  },
  section: {
    marginBottom: tokens.spacing.md,
  },
});
