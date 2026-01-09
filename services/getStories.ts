import { db } from "@/firebaseConfig";
import { useStoriesStore } from "@/store/useStoriesStore";
import { collection, getDocFromCache, getDocs } from "firebase/firestore";

export const getStories = async () => {
    const querySnapshot = await getDocs(collection(db, "stories"));

    const stories = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // setData(stories);
    useStoriesStore.setState({ stories });

    return stories;
  };