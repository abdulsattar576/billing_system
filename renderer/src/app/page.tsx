// "use client";

// import Link from "next/link";
// import { motion, useInView } from "framer-motion";
// import { useRef } from "react";

// const sentence = "Welcome to Family Cable Network Management System";

// const container = {
//   hidden: {},
//   visible: {
//     transition: {
//       staggerChildren: 0.06,
//     },
//   },
// };

// const wordAnimation = {
//   hidden: {
//     opacity: 0,
//     y: 30,
//     filter: "blur(8px)",
//   },
//   visible: {
//     opacity: 1,
//     y: 0,
//     filter: "blur(0px)",
//     transition: {
//       duration: 0.6,
//     },
//   },
// };


// export default function Home() {
//   const ref = useRef(null);
//   const isInView = useInView(ref, { once: true, margin: "-100px" });

//   return (
//     <main className="w-full">
//       <div
//         ref={ref}
//         className="max-w-3xl mx-auto px-6 py-20 text-center"
//       >
//         {/* Animated Heading */}
//         <motion.h1
//           variants={container}
//           initial="hidden"
//           animate={isInView ? "visible" : "hidden"}
//           className="text-2xl sm:text-3xl md:text-4xl lg:text-4xl font-semibold text-white mb-6 leading-snug flex flex-wrap justify-center gap-x-2"
//         >
//           {sentence.split(" ").map((word, index) => (
//             <motion.span
//               key={index}
//               variants={wordAnimation}
//               className="inline-block"
//             >
//               {word}
//             </motion.span>
//           ))}
//         </motion.h1>

//         {/* Subtitle */}
//         <motion.p
//           initial={{ opacity: 0, y: 20 }}
//           animate={isInView ? { opacity: 1, y: 0 } : {}}
//           transition={{ delay: 0.6, duration: 0.6 }}
//           className="text-gray-300 mb-8"
//         >
//           Manage connections, billing, and reports effortlessly.
//         </motion.p>

//         {/* Button */}
//         <motion.div
//           initial={{ opacity: 0, scale: 0.9 }}
//           animate={isInView ? { opacity: 1, scale: 1 } : {}}
//           transition={{ delay: 0.9, duration: 0.4 }}
//         >
//         <Link
//   href="/login"
//   className="inline-block px-6 py-3 bg-[#732AE2] text-white rounded-md text-base hover:bg-[#5f22c0] transition"
// >
//   Go to Dashboard
// </Link>

//         </motion.div>
//       </div>
//     </main>
//   );
// }


"use client";

import Link from "next/link";

const sentence = "Welcome to Family Cable Network Management System";

export default function Home() {
  return (
    <main className="w-full min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <div className="max-w-3xl mx-auto px-6 py-20 text-center">

        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold mb-6 leading-snug animate-fadeUp">
          {sentence}
        </h1>

        <p className="text-gray-300 mb-8 text-lg animate-fadeUp">
          Manage connections, billing, and reports effortlessly.
        </p>

        <Link
          href="/login"
          className="inline-block px-8 py-4 bg-[#732AE2] text-white rounded-lg text-lg font-medium hover:bg-[#5f22c0] transition shadow-lg animate-fadeUp"
        >
          Go to Dashboard
        </Link>

      </div>
    </main>
  );
}