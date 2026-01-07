import Card from "@/components/card";
import Text from "@/components/text";
import { StatusBar } from "expo-status-bar";
import { FlatList, Platform, StyleSheet, View } from "react-native";

import { db } from "../../firebaseConfig";

import image_card from "../../assets/images/image-card_one.png";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { collection, getDocs } from "firebase/firestore";
import { useStoriesStore } from "@/store/useStoriesStore";

const genAI = new GoogleGenerativeAI("");

export const geminiModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
});

export default function HomeScreen() {
  const [response, setResponse] = useState("");

  const router = useRouter();

  const [data, setData] = useState([]);

  const getStories = async () => {
    const querySnapshot = await getDocs(collection(db, "stories"));

    const stories = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    setData(stories);

    useStoriesStore.setState({
      stories: stories,
    });

    return stories;
  };

  useEffect(() => {
    const generateImage = async (prompt: string) => {
      const result = await geminiModel.generateContent(prompt);
      return result.response.text();
    };

    const askGemini = async () => {
      const text = await generateImage(
        'Generate the story "Fairy Tale Story", chapter 3 and final in a maximum of 2000 words.'
      );
      setResponse(text);
    };

    getStories();

    // askGemini();
  }, []);

  console.log(response, "RESPONSE FROM GEMINI");

  const renderItem = ({ item }) => {
    return (
      <Card
        thumbnail={item.thumbnail}
        title={item.title}
        views={item.views}
        storie={item.storie}
        onPress={() =>
          router.push({
            pathname: item.chapter[0].navigate,
            params: {
              storie: item.chapter[0].storie,
              title: item.chapter[0].title,
              thumbnail: item.chapter[0].thumbnail,
              storyId: item.id,
              currentIndex: 0,
            },
          })
        }
      />
    );
  };

  return (
    <>
      <StatusBar style="light" translucent />
      <View style={styles.container}>
        <View style={styles.content}>
          <Text
            fontFamily="bold"
            fontSize={28}
            color="#FFFFFF"
            style={{ marginTop: Platform.OS === "ios" ? 64 : 0 }}
            title="Most Watched Stories"
          />
        </View>

        <FlatList
          data={data}
          renderItem={renderItem}
          contentContainerStyle={{ paddingLeft: 24 }}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#15141A",
  },

  content: {
    paddingHorizontal: 24,
  },
});
