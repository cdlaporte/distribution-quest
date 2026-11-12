/*
 * Distribution Quest — everything Mr. Laporte (and friends) say.
 * A line is either a string (Mr. Laporte, calm face) or
 * { w: who, e: expression, t: text, mane, hair }.
 * Expressions: calm, happy, excited, annoyed, serious, furious, shocked, defeated, smug, crying
 */
(function () {
  'use strict';
  const DQ = (window.DQ = window.DQ || {});

  DQ.Story = {
    intro1: [
      { e: 'shocked', t: "Wait! WAIT! Don't go down there without me!" },
      { e: 'happy', t: "Whew. Oh, hey there, student! It's me, Mr. Laporte, your friendly neighborhood stats teacher." },
      { e: 'shocked', t: '...Wait. Who are you again? I have a LOT of students. Remind me?' },
    ],
    intro2: (name, hero) => [
      { e: 'excited', t: name ? `Right, of course! ${name}! I knew that. I definitely knew that.` : `Right, of course! I knew that. I definitely knew that.` },
      { e: 'serious', t: 'Listen closely. Below us is the Distribution Dungeon: five floors, and each one is guarded by a monster that feeds on Unit 3 statistics.' },
      { e: 'calm', t: 'Percentiles. Uniform distributions. z-scores. Normal distributions. The Empirical Rule. One guardian for each section.' },
      { e: 'serious', t: 'At the very bottom lives the most powerful of them all: the Empirical Emperor. Legend says he guards a secret that could change a person... FOREVER.' },
      { e: 'happy', t: "The good news? The locks in this dungeon open with math, and you've been practicing!" },
      { e: 'calm', t: 'Use W A S D to move, the arrow keys (or the mouse) to shoot, Space to dash, and E to open things. Wrong answers never hurt you, so take your time.' },
      { e: 'excited', t: "I'm your ally on this quest, and I'll pop in when you need me. Now go make me proud! I have... uh... papers to grade." },
    ],
    welcomeBack: (f) => [
      { e: 'happy', t: `Welcome back! Let's pick up right where you left off: Floor ${f}. Your power-ups and friends are right here with you.` },
    ],
    floorIntro: [
      [],
      [
        { e: 'happy', t: 'Floor 2: The Flatlands! Everything down here is perfectly flat and perfectly fair.' },
        { e: 'calm', t: 'Remember: a uniform distribution is a rectangle. Probability = width × height, and the height is 1 ÷ (b − a).' },
      ],
      [
        { e: 'annoyed', t: 'Standard Deviation Swamp. Ugh, my shoes. Watch your step.' },
        { e: 'calm', t: 'Down here, everything gets measured in z-scores: z = (x − μ) ÷ σ. It tells you how many standard deviations something is from the mean.' },
      ],
      [
        { e: 'excited', t: 'The Bell Tower! Hear that ringing? That is the sound of NORMAL DISTRIBUTIONS.' },
        { e: 'serious', t: 'Open Desmos in another tab for this floor. Type normaldist(μ, σ) and use "Find Cumulative Probability" to get areas under the curve.' },
      ],
      [
        { e: 'serious', t: 'The 68-95-99.7 Abyss. No calculator needed here, just the Empirical Rule.' },
        { e: 'calm', t: '68% of the data is within 1 standard deviation of the mean, 95% within 2, and 99.7% within 3.' },
        { e: 'smug', t: "The Emperor's lair is somewhere on this floor. Oh, and if he drops anything shiny... bring it to me. For, uh, safekeeping." },
      ],
    ],
    bossIntro: [
      [
        { w: 'rank', t: 'RANKENSTEIN RISES! I AM MADE OF EVERY DOT FROM EVERY DOTPLOT EVER DRAWN!' },
        { e: 'shocked', t: "Rankenstein! He ranks EVERYTHING. He told me I'm in the 3rd percentile of teachers for handwriting. RUDE." },
        { e: 'serious', t: 'Watch for glowing columns: that is where his dots will drop. Find the gap and stand in it!' },
      ],
      [
        { w: 'mono', t: 'I AM THE UNIFORM MONOLITH. EVERY OUTCOME IS EQUALLY LIKELY... EQUALLY LIKELY TO DEFEAT YOU.' },
        { e: 'serious', t: 'Its walls of bullets always have a gap. Line yourself up with the gap and let the wall pass you by!' },
      ],
      [
        { w: 'zed', t: 'Welcome, ssstudent. I am Zed. I measure every creature by how many standard deviations it is from the mean...' },
        { w: 'zed', t: 'And YOU are about to become VERY unusual.' },
        { e: 'serious', t: 'Zed teleports between the rings at 1 and 2 standard deviations from the center. Keep moving!' },
      ],
      [
        { w: 'bell', t: 'DONNNNG! I AM THE GREAT BELLRINGER! MY SHAPE IS NORMAL. MY POWER IS NOT!' },
        { e: 'excited', t: 'Its volleys are shaped like a bell curve: lots of bullets in the middle, only a few out in the tails. Dodge toward the tails!' },
        { e: 'serious', t: 'And when it highlights a shaded region on the floor... get OUT of the shaded area!' },
      ],
      [
        { w: 'emp', t: 'So. You have survived 68 rooms... 95 monsters... and 99.7 of my traps.' },
        { w: 'emp', t: 'I am the EMPIRICAL EMPEROR, and my treasure shall NEVER be yours!' },
        { e: 'serious', t: 'His rings cover 68%, then 95%, then 99.7% of the circle. That last one barely has a gap, so DASH through it with Space!' },
      ],
    ],
    bossDefeat: [
      [{ e: 'happy', t: 'You beat Rankenstein! That puts you in the 99th percentile of dungeon heroes. (Not 100th. Percentiles count the values BELOW you!)' }],
      [{ e: 'happy', t: 'The Monolith crumbled! Into equally sized pieces, naturally. Grab your loot and head down the stairs!' }],
      [{ e: 'excited', t: 'Zed is down! Your z-score for bravery is off the charts.' }],
      [{ e: 'excited', t: 'No more ringing! My ears thank you. One floor left... the Emperor awaits.' }],
      [],
    ],
    secTips: {
      '3.1': 'A percentile is the percent of the data values <b>below</b> a value. Count how many values are less than it, then divide by how many values there are.',
      '3.2': 'A uniform density curve is a rectangle with height 1 ÷ (b − a). Probability = width × height!',
      '3.3': 'z = (x − μ) ÷ σ. A bigger z-score is better... unless lower is better, like wait times!',
      '3.4': 'Open Desmos in another tab and type <b>normaldist(μ, σ)</b>. Turn on "Find Cumulative Probability" to get the area.',
      '3.5': 'Label μ, then ±1σ, ±2σ, ±3σ. The pieces of the curve are 34%, 13.5%, 2.35% and 0.15%.',
    },
    tips: {
      chest: { e: 'excited', t: 'Ooh, a Stat Chest! Walk up and press E. Solve the problem inside to pick a power-up.' },
      treasure: { e: 'excited', t: 'A Golden Stat Chest! These have the best loot, and a perfect solve (first try, no hints) gives you extra.' },
      shrine: { e: 'happy', t: 'A Shrine of the Mean! Solve its problem and it will heal you to full.' },
      shop: { e: 'happy', t: "A talking vending machine! Spend your coins here. Don't ask me where it gets its snacks." },
      rune: { e: 'serious', t: 'Shield up! Run to the glowing rune and solve it to shatter the shield. The fight pauses while you work.' },
    },
    lounge: [
      { e: 'shocked', t: "Hey! How did you get into the Teachers' Lounge?! Students aren't allowed in here!" },
      { e: 'annoyed', t: "...Fine. Since you found it, you can use the staff-only coffee machine. It makes STAFF upgrades. They're very powerful." },
      { e: 'serious', t: 'The couch heals you, too. But do NOT touch my edamame.' },
    ],
    edamameBowl: "HEY! That's MY edamame! ...Okay, fine. Protein is important. Enjoy.",
    eddie: "Wait... is that one of my edamame pods following you?! You've eaten so many that one JOINED YOUR PARTY. Meet Eddie the Edamame!",
    edamameCode: 'Did you just type EDAMAME? ...You know me so well. Here, have some.',
    youRang: ['You rang?', 'Did someone say my name? Focus on the dungeon!', "I'm always watching. Mostly for phones."],
    outlierJoin: 'Aww, the Outlier joined you! Everyone said it was too far from the mean. I think it is just special.',
    quips: [
      ['Fun fact: if you scored better than 80% of the class, you are at the 80th percentile. Not 80%!', 'Percentiles are like a ranking. The higher the percentile, the more of the data is below you.', 'Dotplots everywhere down here. Count the dots BELOW, then divide by the total!'],
      ['Uniform means every value in the interval is equally likely. Flat as a pancake!', 'The mean of a uniform distribution is right in the middle: (a + b) ÷ 2.', 'To find a percentile here, go that percent of the way from a to b.'],
      ['A z-score of 0 means exactly average. Positive is above the mean, negative is below.', 'Anything more than 2 standard deviations from the mean is considered unusual. Like this swamp.', 'Comparing two people from different groups? Compare z-scores, not raw scores!'],
      ['Remember to draw the curve and shade the region you want. THEN go to Desmos.', '"Top 5%" means 95% of the data is below it. Use inversecdf(0.95)!', 'Between two values? Set both the min and the max in Desmos.'],
      ['68-95-99.7. Say it with me! 68-95-99.7!', 'Half of the data is above the mean, and half is below. 50% each!', 'The 16th percentile is one standard deviation below the mean. The 84th is one above.'],
    ],
    petNames: ['Gerald', 'Sir Wobbles', 'Kevin', 'Princess Goo', 'Bloop', 'Mean Bean', 'Median Mike', 'Sigma', 'Nugget', 'Dave'],
    securityYell: ['SECURITY!', 'SECURITY! We have a situation!', "SECURITY! This one isn't even in my class!"],
    securityEnemy: ['Hey! Put me down!', 'I want to speak to the principal!', 'But I was in the 90th percentile of scary!', 'This is so unfair!'],
    securityDone: ['And STAY out! Sorry about that. Carry on!', 'Phew. That one was skipping class anyway.', 'Thank you, gentlemen. Back to work, everyone!'],
    helpLines: ['Here! A pass to the nurse! Take these hearts!', 'Hang in there! Hearts, coming through!', "Don't give up! You've got this!"],
    boardNotes: [
      '"WHO KEEPS EATING MY EDAMAME? — L."',
      '"Reminder: 68% within 1 standard deviation, 95% within 2, 99.7% within 3."',
      '"Staff meeting moved to the 50th percentile of the day (around noon)."',
      '"LOST: one vial of hair tonic. Not mine. Definitely not mine. — Anonymous"',
      '"Bake sale! Cookies are uniformly distributed between delicious and VERY delicious."',
      '"Please do not let the Bellringer into the copy room again."',
      '"The copier jams have a z-score of +3.2. That is VERY unusual. Please call maintenance."',
      '"Whoever drew a bell curve on the whiteboard with permanent marker: it IS very normal, but please stop."',
    ],
    fridge: 'A sticky note on the fridge says "MR. LAPORTE\'S — DO NOT TOUCH." Inside: 47 containers of edamame. You take one. He will never notice.',
    vendingLines: [
      'BEEP BOOP. Welcome, customer! My prices are uniformly distributed between expensive and VERY expensive.',
      'I am in the 99th percentile of vending machines.',
      "Psst. Snack number 7 is usually stuck. Don't tell anyone.",
      "Insert coins! I don't take hall passes.",
    ],
    vendingThanks: ['Thank you for your purchase! BEEP!', 'Excellent choice! Statistically speaking.', 'A fine selection, with a z-score of +2!'],
    hats: [
      { name: "Rankenstein's Top Hat (99th percentile fancy)", emoji: '🎩' },
      { name: "The Monolith's Flat-Brim Hat", emoji: '🤠' },
      { name: "Zed's Graduation Cap", emoji: '🎓' },
      { name: 'A Tiny Bell (it jingles)', emoji: '🔔' },
      { name: 'The Empirical Crown', emoji: '👑' },
    ],
    twist1: [
      { e: 'excited', t: 'YOU DID IT! The Empirical Emperor is defeated! I knew you could—' },
      { e: 'shocked', t: '...wait. What is THAT?' },
    ],
    twist2: [
      { e: 'shocked', t: "It can't be... a vial of SECRET HAIR TONIC?!" },
      { e: 'serious', t: "For years... YEARS... I've watched my hairline shrink like the tail of a normal curve." },
      { e: 'smug', t: "The Emperor wasn't guarding treasure. He was guarding THIS. And now... it's MINE." },
      { w: 'you', t: 'Mr. Laporte, maybe don\'t drink the mysterious dungeon potion?' },
      { e: 'smug', t: "Relax. I'm a professional." },
    ],
    twist3: [
      { e: 'furious', t: '*glug glug glug glug*' },
      { e: 'shocked', t: 'I... I can feel it... my follicles... they are... they are...' },
    ],
    twist4: [
      { e: 'furious', mane: 1, t: 'AAAAAAAAHHHHHHHHHHHH!!!!!' },
      { e: 'smug', mane: 1, t: 'BEHOLD! A FULL. LUSCIOUS. MANE! My hair is now THREE standard deviations above the mean!' },
      { e: 'furious', mane: 1, t: 'With this power, I will give the whole school a POP QUIZ every single day! FOREVER!' },
      { e: 'smug', mane: 1, t: 'You have learned well, student. But can you defeat... SUPER MANE LAPORTE?!' },
    ],
    maneQuips: [
      'This hair is FOREVER!', 'Feel the power of the FOLLICLES!', "Who's ready for a POP QUIZ?!", 'My mane has a z-score of +10!',
      'No more comb-overs! NEVER AGAIN!', 'Is it hot in here, or is it just my HAIR?!', 'Show your work!', 'Pencils DOWN!',
    ],
    finale1: [
      { e: 'shocked', mane: 1, t: 'No... NO! My beautiful mane... it is... it is FALLING OUT!' },
    ],
    finale2: [
      { e: 'crying', hair: 0, t: '*sniff* It was... so... luscious...' },
      { e: 'defeated', hair: 0, t: "I'm sorry. The tonic went straight to my head. Literally." },
      { e: 'calm', hair: 0, t: 'But you know what? You beat every guardian, and you did it with percentiles, uniform distributions, z-scores, normal curves AND the Empirical Rule.' },
      { e: 'happy', hair: 0, t: "That's worth more than any hair tonic. I'm really proud of you." },
      { e: 'smug', hair: 0, t: "...We're still having a quiz on Friday, though." },
    ],
    endWin: "You beat the dungeon AND me. Your stats skills are in the 100th percentile... wait, that's impossible. Let's call it the 99th.",
    endLose: (f, n) => `Don't worry, I'll drag you back to the start of Floor ${f}. You'll lose the power-ups you found on this floor, but you keep everything from earlier floors${n ? `, and the ${n} problem${n === 1 ? '' : 's'} you already solved here will be free` : ''}.`,
    retry: (f, n) => [
      { e: 'calm', t: `Back to the start of Floor ${f}. Deep breath. The dungeon has been rearranged, so keep your eyes open.` },
      ...(n ? [{ e: 'happy', t: `And since you already solved ${n} problem${n === 1 ? '' : 's'} on this floor, the next ${n === 1 ? 'one is' : n + ' are'} on the house!` }] : []),
    ],
    freeSolve: "You already solved one of these before you got knocked out. This one's on the house!",
    lapSolveStart: ['Ooh, a Stat Chest! Hold on, let me get this one!', 'Wait wait wait, I LOVE this kind of problem!', 'Step aside, I got this one!'],
    lapSolveDone: ["Done! Easy. Here's your upgrade!", "Solved it! Don't tell the other teachers.", 'Ha! Still got it. Pick your prize!'],
    finalRetry: 'Back for more?! My mane and I have been WAITING for you!',
    defeatLines: {
      bat: ['Defeated by a bat. A BAT.', 'The bat would like everyone to know it did this on purpose.'],
      slime: ['Absorbed by a slime. It says you were delicious.', 'Defeated by the weakest monster in the dungeon. Bold strategy.'],
      bigslime: ['Flattened by a big slime. Its z-score for size is way above zero.'],
      archer: ['You walked into an arrow. Probably more than once.', 'The skeleton archer has been practicing. You have not been dodging.'],
      boar: ['Run over by a charging boar. It did not even slow down.'],
      eye: ['Stared down by a giant eyeball. You blinked first.'],
      ghost: ['Spooked by an outlier. Outliers really do change everything.'],
      boss: ['The boss would like a rematch. So would I!'],
      hazard: ['You stood in the shaded region. That is exactly where you should NOT stand!'],
      generic: [
        'You were outnumbered {n} to 1. Those are bad odds.',
        'Defeated! But your math skills? Undefeated.',
        'The dungeon: 1. You: 0. Rematch time.',
        "That run had a z-score of −3. Very unusual. Let's go again!",
      ],
    },
  };
})();
