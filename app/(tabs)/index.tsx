import Card from "@/components/card";
import Text from "@/components/text";
import { StatusBar } from "expo-status-bar";
import { FlatList, Platform, ScrollView, StyleSheet, View } from "react-native";

import { db } from "../../firebaseConfig";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import {
  collection,
  doc,
  getDocs,
  increment,
  updateDoc,
} from "firebase/firestore";
import { useStoriesStore } from "@/store/useStoriesStore";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { useLikedStore } from "@/store/useLikedStore";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getStories } from "@/services/getStories";
import CardSkeleton from "@/components/card-skeleton";

const genAI = new GoogleGenerativeAI("AIzaSyBW5Kqpf2uY-X8W3mA_0_1ORPz2qyQBT8M");

export const geminiModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
});

export default function HomeScreen() {
  const [response, setResponse] = useState("");
  const router = useRouter();

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

  useEffect(() => {
    const generateText = async (prompt: string) => {
      const result = await geminiModel.generateContent(prompt);
      return result.response.text();
    };

    const askGemini = async () => {
      const text = await generateText(
        'Generate the story "Fairy Tale Story", chapter 3 and final in a maximum of 2000 words.'
      );
      setResponse(text);
    };

    getStories();

    // askGemini();
  }, []);

  console.log(response, "RESPONSE FROM GEMINI");

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
