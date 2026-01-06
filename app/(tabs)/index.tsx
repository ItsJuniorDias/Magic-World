import Card from "@/components/card";
import Text from "@/components/text";
import { StatusBar } from "expo-status-bar";
import { FlatList, Platform, StyleSheet, View } from "react-native";

import image_card from "../../assets/images/image-card_one.png";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";

const genAI = new GoogleGenerativeAI("");

export const geminiModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
});

export default function HomeScreen() {
  const [response, setResponse] = useState("");

  const router = useRouter();

  const DATA = [
    {
      id: "1",
      title: "Fairy Tale Story",
      views: 3,
      thumbnail:
        "https://res.cloudinary.com/dqvujibkn/image/upload/v1767731509/image-card_one_zr35rs.png",
      storie:
        "Once upon a time, in a tall and shining castle called Aurelion, there lived a young princess. Her name was Elowen, and her hair was red like dancing flames. When the sunlight touched it, it sparkled as if tiny fires were hidden inside. Everyone said it was beautiful, but Elowen felt that her hair carried a secret. One quiet night, while the moon watched from the sky, Elowen was brushing her hair when she heard a bell. Ding. She stopped and listened. The castle bells usually rang for happy things—celebrations, visitors, or music in the great hall. But this bell sounded different. It sounded worried. Suddenly, the door opened. “Elowen!” said Mara, her kind caretaker, hurrying inside. “You must leave right away.” Elowen’s eyes grew wide. “Why?” Mara knelt beside her and spoke softly. “The witches are coming.” Elowen had heard stories about witches, but only in bedtime tales. Seeing fear in Mara’s eyes made her heart beat faster. Outside, the bells began to ring again. Lights flickered, and people hurried through the castle halls. “They are looking for you,” Mara said gently. “Because you are special.” Mara wrapped a warm, dark cloak around Elowen’s shoulders. “Hide your hair,” she said. “Follow the secret stairs behind the wall hanging. Be brave, and do not stop.” Before Elowen could ask more, Mara placed a small golden crown in her hands. In the middle was a glowing red stone. “This is the Ember Crown,” Mara said. “It belongs to you.” The stone felt warm, like a friendly spark. “I’ll come back for you,” Elowen promised. Mara smiled, even though her eyes were shiny with tears. “I know you will.” Elowen slipped through the hidden passage and ran down the winding stairs. The castle seemed to whisper as she passed. At the end of the tunnel, she stepped outside. The forest stretched wide and quiet before her. Suddenly, she heard soft voices in the trees. “Little flame,” they whispered. Elowen hugged the crown close. She felt scared—but also strong. When she held up the Ember Crown, a gentle ring of warm light appeared around her, glowing like a campfire. It did not burn. It protected. The shadows pulled back. Elowen took a deep breath and ran into the forest, toward a brand-new adventure. That night, a princess learned she was brave. And her fairy tale had only just begun.",
      navigate: "/(storie)",
    },
    {
      id: "2",
      title: "The Boy, the Mole, the Fox and the Horse",
      views: 2,
      thumbnail:
        "https://70f186a60af817fe0731-09dac41207c435675bfd529a14211b5c.ssl.cf1.rackcdn.com/assets/attachments_p/000/096/205/size500_theboy_web.jpg",
      storie: `The boy walked. His boots made soft thuds on the damp earth, a rhythm to his quiet thoughts. The trees, tall and elegant even in their nakedness, watched from either side of the path, their branches a delicate web against the pale sky. It was late autumn, or perhaps early winter; the air was sharp with the scent of decaying leaves and wet soil, and a soft, grey light filtered through the thinning canopy.
He carried a quiet longing, a question he hadn't yet learned to articulate, a feeling that whispered at the edges of his mind. He wasn't entirely sure where he was going, only that he was going. He’d left behind whatever it was he thought he needed to leave behind, and now he was simply moving, one foot in front of the other, through a world that felt both vast and intimately silent.
A small mound of earth shifted beside the path. Then, a tiny, inquisitive snout poked out, followed by two bright, beady eyes. And then, the rest of him – a small, round, black creature, blinking against the muted light.
“Hello!” chirped the mole, his voice surprisingly clear and bright for such a small thing. He looked up at the boy, then around, as if expecting something more. "Do you happen to have any cake?"
The boy stopped, a faint smile touching his lips. He hadn't seen another soul in what felt like a very long time. “I don't think so,” he said softly. "Just me."
The mole tilted his head, considering this. "Oh. Well, that’s alright too. I'm a mole. I like cake very much." He made a small, satisfied sigh, as if merely thinking of cake brought him joy. "What are you?"
“I’m a boy,” he replied, a little self-consciously. "I’m not entirely sure what I like yet.
The mole scurried a little closer, his tiny claws scratching lightly on the damp leaves. "That's okay. It’s good to be curious. It's good to not know everything right away. Sometimes, just walking is enough." He looked around again, his nose twitching. "Though walking *with* cake is even better."
The boy chuckled, a sound that felt rusty from disuse. “I suppose it is.
“What are you looking for?” the mole asked, picking at a tiny piece of root that had clung to his fur
The boy paused, looking out at the distant, mist-shrouded fields. "I'm not sure," he admitted. "Maybe... a home. Or a reason. Or just a friend."
The mole straightened up, his eyes earnest. "A friend? Well, you've found one. I can walk with you." He seemed genuinely delighted by this prospect. "I'm very good at finding worms, and sometimes, if you're lucky, I even find little bits of forgotten cake."
"Thank you," the boy said, a warmth spreading in his chest. It was a simple offer, but it felt enormous, like a hand reaching out in the dark.
“No need to thank me,” the mole said, bustling about. “It’s much nicer to walk with someone. The world feels less vast that way, don't you think? Less… lonely.” He looked up at the boy, his little face serious. “Do you ever feel lonely?”
The boy nodded slowly. "Often. Even when I'm surrounded by things, I sometimes feel very alone.
“Ah,” said the mole, understanding in his tiny voice. “That’s a big feeling, isn't it? But remember, even when you feel alone, you are never truly alone in the world. There are always others, even if you haven't met them yet.” He pointed a tiny claw towards the horizon. “And look, the world is quite beautiful, even when it’s a bit grey.”
They began to walk again, the small mole bustling beside the boy’s quiet steps. The boy found himself watching the mole, marveling at his simple joy, his immediate acceptance, his profound, uncomplicated wisdom.
"What's the bravest thing you've ever said?" the boy asked after a while, the question bubbling up unexpectedly.
The mole considered this, his little brow furrowed in thought. "Hmm. I think it was 'Help.'" He looked at the boy. "Asking for help isn't giving up. It's refusing to give up."
The boy mulled this over, letting the words settle. He had always thought bravery was about facing things alone.
"And what's the kindest thing anyone has ever said to you?" the mole continued, ever curious.
"I think..." the boy hesitated. "I think it might have been 'You are enough.'" He hadn't heard it often, and sometimes he found it hard to believe, but the words held a quiet power.
“Oh, that’s a good one,” the mole declared, hopping over a fallen leaf. “Everyone needs to hear that sometimes. Especially themselves.”
They walked on through the whispering woods, the light fading a little more, painting the world in shades of charcoal and muted silver. The boy felt a lightness he hadn't known was missing, a quiet joy simply in the presence of this small, cake-loving creature. He still didn't know where they were going, or what they would find, but the journey no longer felt quite so daunting. He had a companion. And perhaps, that was enough for now.
As they emerged from the trees into a wide, open field, the last sliver of the sun dipped below the distant hills, painting the sky with a fleeting blush of orange and pink. The world grew silent, save for the soft rustle of dry grass.
"It's getting cold," the boy observed, pulling his jacket tighter.
"It is," agreed the mole, snuggling a little closer to the boy's boot. "But even in the cold, there's warmth to be found. In friendship, in a good thought, in the promise of cake." He looked up at the boy, his eyes reflecting the last light of the day. "Are you still glad you're walking?"
"Yes," the boy said, a genuine smile spreading across his face. "Yes, I am. Especially with you."
The mole beamed, a small, contented sigh escaping him. "Good. Because I'm very glad to be walking with you too. And who knows, perhaps there's cake waiting somewhere."
And so, under the vast, deepening sky, the boy and the mole continued their journey, two small figures against the grand canvas of the world, no longer alone. The path ahead was still unknown, but now, it was a path they would explore together.
                `,
      navigate: "/(storie)",
    },
  ];

  useEffect(() => {
    const generateImage = async (prompt: string) => {
      const result = await geminiModel.generateContent(prompt);
      return result.response.text();
    };

    const askGemini = async () => {
      const text = await generateImage(
        'Generate the story "The Boy, the Mole, the Fox and the Horse", chapter 1 in a maximum of 2000 words.'
      );
      setResponse(text);
    };

    // askGemini();
  }, []);

  console.log(response, "RESPONSE");

  const renderItem = ({ item }) => {
    return (
      <Card
        thumbnail={item.thumbnail}
        title={item.title}
        views={item.views}
        storie={item.storie}
        onPress={() =>
          router.push({
            pathname: item.navigate,
            params: {
              storie: item.storie,
              title: item.title,
              thumbnail: item.thumbnail,
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
          data={DATA}
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
