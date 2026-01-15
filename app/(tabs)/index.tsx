import Card from "@/components/card";
import Text from "@/components/text";
import { StatusBar } from "expo-status-bar";
import { FlatList, Platform, ScrollView, StyleSheet, View } from "react-native";

import { db } from "../../firebaseConfig";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  increment,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { useStoriesStore } from "@/store/useStoriesStore";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

import { useLikedStore } from "@/store/useLikedStore";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getStories } from "@/services/getStories";
import CardSkeleton from "@/components/card-skeleton";

const genAI = new GoogleGenerativeAI(
  process.env.EXPO_PUBLIC_GOOGLE_API_KEY || ""
);

export const geminiModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
});

export function generateImage(prompt: string) {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(
    prompt
  )}?width=1024&height=1024&seed=${Date.now()}`;
}

export default function HomeScreen() {
  const router = useRouter();

  const [generatedStory, setGeneratedStory] = useState<any>(null);

  const likedIds = useLikedStore((s) => s.likedIds);
  const toggleLike = useLikedStore((s) => s.toggleLike);

  const loadLikedStories = useLikedStore((s) => s.loadLikedStories);

  const query = useQuery({ queryKey: ["stories"], queryFn: getStories });

  const incrementStoryViews = async (storyId: string) => {
    const storyRef = doc(db, "stories", storyId);

    // Atualiza no Firestore
    await updateDoc(storyRef, {
      views: increment(1),
    });

    // Atualiza localmente no Zustand (UX instantânea)
    useStoriesStore.setState((state) => ({
      stories: state.stories.map((story) =>
        story.id === storyId
          ? { ...story, views: (story.views ?? 0) + 1 }
          : story
      ),
    }));
  };

  async function generateStoryWithImages() {
    const textResult = await geminiModel.generateContent(`
Generate a complete JSON object following EXACTLY the structure below.

Choose a category: future.
Language: English
Tone: epic, immersive, mysterious
Style: saga narrative
Audience: children

Rules:
- Exactly 3 chapters
- First chapter locked = false
- Others locked = true
- storie must be around 2000 words
- Return ONLY valid JSON (no markdown, no text)

Structure:
{
  category: "",
  title: "",
  thumbnail: "",
  views: 0,
  id: "",
  chapter: [
    {
      locked: false,
      navigate: "/(storie)",
      storie: "",
      title: "",
      thumbnail: ""
    },
    {
      locked: true,
      navigate: "/(storie)",
      storie: "",
      title: "",
      thumbnail: ""
    },
    {
      locked: true,
      navigate: "/(storie)",
      storie: "",
      title: "",
      thumbnail: ""
    }
  ]
}
`);

    const cleaned = textResult.response
      .text()
      .replace(/```json|```/g, "")
      .trim();

    console.log("CLEANED JSON:", cleaned);

    const story = JSON.parse(cleaned);

    return story;
  }

  useEffect(() => {
    const load = async () => {
      try {
        // const story = await generateStoryWithImages();
        // console.log("GENERATED STORY:", story);
        // const result = await addDoc(collection(db, "stories"), {
        //   ...story,
        //   createdAt: serverTimestamp(),
        // });
        // console.log(result, "STORY ADDED WITH ID");
      } catch (err) {
        console.error(err);
      }
    };

    load();
  }, []);

  // console.log(response, "RESPONSE FROM GEMINI");

  const renderItem = ({ item, variant }: any) => (
    <Card
      variant={variant}
      thumbnail={item.thumbnail}
      title={item.title}
      views={item.views}
      isFavorite={likedIds.includes(item.id)}
      onToggleFavorite={() => {
        toggleLike({
          storyId: item.id,
          title: item.title,
          thumbnail: item.thumbnail,
          chapter: item.chapter,
        });

        loadLikedStories();
      }}
      onPress={async () => {
        if (variant !== "category") {
          await incrementStoryViews(item.id);
        }

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
      }}
    />
  );

  // 🔥 Mais vistas
  const mostWatched = [...(query.data ?? [])].sort(
    (a, b) => (b.views ?? 0) - (a.views ?? 0)
  );

  // 🗂 Categoria (exemplo: Fairy Tale)
  const categoryStories = [
    {
      id: "1",
      title: "Children's Comic",
      chapter: [
        {
          navigate: "/(categories)",
        },
      ],
      thumbnail:
        "https://res.cloudinary.com/dqvujibkn/image/upload/v1767753186/Gemini_Generated_Image_mijilhmijilhmiji_1_frh7nh.png", // substitua pela sua imagem
    },
  ];

  // 🕒 Publicadas recentemente
  const recentlyPublished = [...(query.data ?? [])].sort(
    (a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)
  );

  const Section = ({
    title,
    data,
    variant,
  }: {
    title: string;
    data: any[];
    variant?: "default" | "category" | "recent";
  }) => (
    <View style={styles.section}>
      <Text
        title={title}
        fontFamily="bold"
        fontSize={24}
        color="#FFFFFF"
        style={{ marginBottom: 12, marginLeft: 24 }}
      />

      {query.isLoading ? (
        <FlatList
          data={[{}, {}, {}, {}, {}]}
          renderItem={() => <CardSkeleton variant={variant} />}
          horizontal
          keyExtractor={(item) => item.toString()}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingLeft: 24 }}
        />
      ) : (
        <FlatList
          data={data}
          renderItem={(item) => renderItem({ ...item, variant })}
          horizontal
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingLeft: 24 }}
        />
      )}
    </View>
  );

  return (
    <>
      <StatusBar style="light" translucent />
      <ScrollView showsVerticalScrollIndicator={false} style={styles.container}>
        <Section
          title="Most Watched Stories"
          data={mostWatched}
          variant="default"
        />

        <Section title="Categories" data={categoryStories} variant="category" />

        <Section
          title="Recently Published"
          data={recentlyPublished}
          variant="recent"
        />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#15141A",
    paddingTop: Platform.OS === "ios" ? 8 : 24,
  },

  section: {
    marginBottom: 16,
  },
});
