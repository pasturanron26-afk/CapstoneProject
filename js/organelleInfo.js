// ======================================================
// ANIMAL CELL ORGANELLE INFORMATION
// ======================================================

const organelleInformation = {

    // ==================================================
    // DEFAULT — ANIMAL CELL OVERVIEW
    // ==================================================

    animalCell: {

        title: "Animal Cell",

        pronunciation: "",

        sections: [

            {
                heading: "What is an Animal Cell?",
                body:
                    "An animal cell is a highly complex, microscopic eukaryotic cell. " +
                    "This means its genetic material (DNA) is enclosed within a defined, " +
                    "double-membrane-bound nucleus, and its cellular processes are carried " +
                    "out by specialized, membrane-bound organelles suspended in the cytoplasm. " +
                    "It is the basic structural and functional unit of life for all organisms " +
                    "in the Kingdom Animalia, serving as the fundamental building block that " +
                    "groups together to form tissues, organs, and organ systems."
            },

            {
                heading: "What Makes It Unique?",
                body:
                    "The defining features of an animal cell are its flexible cell membrane " +
                    "as its outermost boundary and the complete absence of a rigid outer cell " +
                    "wall or photosynthetic chloroplasts. It also commonly contains specialized " +
                    "organelles like centrosomes (with centrioles), lysosomes, cilia, and " +
                    "flagella, which are structures generally not found in plant cells. " +
                    "Unlike plant cells, animal cells lack a cell wall and chloroplasts, so " +
                    "they cannot perform photosynthesis and must obtain nutrition by absorbing " +
                    "nutrients. Animal cells also only contain small, temporary vacuoles " +
                    "rather than a single massive central vacuole."
            },

            {
                heading: "Shape & Structure",
                body:
                    "Animal cells do not have a single fixed shape. They are generally " +
                    "irregular, flexible, and highly variable, taking round, oval, flattened, " +
                    "elongated, concave, or branched forms. This flexibility exists because " +
                    "they lack the rigid cell wall that gives plant cells their fixed, " +
                    "box-like shapes. Through cell differentiation, animal cells acquire " +
                    "specialized structures perfectly matched to their tasks. Muscle cells " +
                    "are packed with sliding filaments for contraction. Neurons have long " +
                    "projections for transmitting electrical impulses. Red blood cells form " +
                    "a concave disc shape to squeeze through capillaries, and intestinal " +
                    "cells are lined with microvilli to maximize nutrient absorption."
            },

            {
                heading: "Did You Know?",
                body:
                    "To maximize efficiency, some animal cells undergo radical transformations. " +
                    "Mature mammalian red blood cells completely eject their nuclei and " +
                    "mitochondria during development. They sacrifice their own genetic blueprint " +
                    "just to fit as much oxygen-carrying hemoglobin as possible. Meanwhile, " +
                    "the largest single animal cell in nature is the ostrich egg, which can " +
                    "measure 5 inches in diameter and weigh up to 1.4 kg!"
            }

        ],

        sources: [
            { author: "Bailey, R.", year: "2024, August 2", title: "All about animal cells. ThoughtCo.", url: "https://www.thoughtco.com/all-about-animal-cells" },
            { author: "Fields, D.", year: "2026, August 18", title: "What are organelles? (A. Khetrapal, Rev.). News-Medical.", url: "https://www.news-medical.net/life-sciences/What-Are-Organelles.aspx" },
            { author: "GeeksforGeeks.", year: "2026, April 24", title: "Cell organelles.", url: "https://www.geeksforgeeks.org/biology/cell-organelles-definition-structure-types-functions/" },
            { author: "Helmenstine, A.", year: "2026, August 9", title: "Animal cell – diagram, organelles, and characteristics. Science Notes and Projects.", url: "https://sciencenotes.org/animal-cell-diagram-organelles-and-characteristics/" },
            { author: "Khan Academy.", year: "n.d.", title: "Cellular organelles and structure.", url: "https://www.khanacademy.org/test-prep/mcat/cells/eukaryotic-cells/a/organelles-article" },
            { author: "Lumen Learning.", year: "n.d.", title: "Organelles. Biology for Majors I.", url: "https://courses.lumenlearning.com/suny-wmopen-biology1/chapter/outcome-organelles/" },
            { author: "Lumen Learning.", year: "n.d.", title: "The cytoplasm and cellular organelles. Anatomy and Physiology I.", url: "https://courses.lumenlearning.com/suny-ap1/chapter/the-cytoplasm-and-cellular-organelles/" },
            { author: "Maharjan, A.", year: "2025, October 28", title: "Plant and animal cell organelles with structure, functions (S. Aryal, Ed.). Microbe Notes.", url: "https://microbenotes.com/organelles-plant-and-animal/" },
            { author: "Mokobi, F.", year: "2026, July 21", title: "Animal cell: Structure, parts, functions, labeled diagram (S. Aryal, Ed.). Microbe Notes.", url: "https://microbenotes.com/animal-cell-definition-structure-parts-functions-and-diagram/" },
            { author: "RMIT University.", year: "2026", title: "Organelles and their functions. RMIT University Learning Lab.", url: "https://learninglab.rmit.edu.au/life-science/structure-and-function-of-cells/organelles/" },
            { author: "Save My Exams.", year: "2025, March 5", title: "Animal cells - GCSE biology definition (C. Head, Rev.). Save My Exams.", url: "https://www.savemyexams.com/" }
        ]

    },


    // ==================================================
    // CELL MEMBRANE
    // ==================================================

    cellMem: {

        title: "Cell Membrane",

        pronunciation: "sel mem-brayn",

        sections: [

            {
                heading: "What Is It?",
                body:
                    "The cell membrane (also known as the plasma membrane) is a thin, " +
                    "delicate, semipermeable barrier that surrounds the cytoplasm, encloses " +
                    "the cell's internal contents, and separates the intracellular environment " +
                    "from the external surroundings. Because animal cells lack a rigid outer " +
                    "cell wall, the flexible cell membrane acts as the outermost barrier of " +
                    "the cell, allowing for a highly variable shape and active motility."
            },

            {
                heading: "Structure",
                body:
                    "It is composed of a phospholipid bilayer consisting of phosphoglycerides, " +
                    "sphingolipids, and sterols. Hydrophilic heads face outward while hydrophobic " +
                    "hydrocarbon tails point inward. This bilayer is embedded with transport " +
                    "proteins and decorated with external carbohydrate chains forming " +
                    "glycoproteins and glycolipids that facilitate cellular communication " +
                    "and cell-to-cell recognition."
            },

            {
                heading: "How It Works",
                body:
                    "It acts as a selectively permeable barrier. Small, uncharged molecules " +
                    "can diffuse freely through the lipid bilayer, while embedded transmembrane " +
                    "proteins actively or passively pump larger or highly charged molecules " +
                    "across. Essential nutrients, water, ions, and oxygen pass in. Metabolic " +
                    "wastes, carbon dioxide, and manufactured secretions pass out. It also " +
                    "fuses with transport vesicles arriving from the Golgi apparatus to " +
                    "incorporate new membrane proteins or release chemical payloads."
            },

            {
                heading: "Did You Know?",
                body:
                    "Despite acting as a protective barrier, the membrane is highly dynamic. " +
                    "Its structural proteins can assemble and disassemble in just a few minutes " +
                    "depending on what the cell needs at that moment."
            }

        ],

        sources: []

    },


    // ==================================================
    // CENTRIOLE
    // ==================================================

    centriole: {

        title: "Centriole",

        pronunciation: "sen-tree-ohl",

        sections: [

            {
                heading: "What Is It?",
                body:
                    "A centriole is a small, hollow, cylindrical, non-membrane-bound " +
                    "structure that resides inside the centrosome of animal cells. It " +
                    "functions as the principal microtubule-organizing center (MTOC), " +
                    "coordinating the cellular microtubule network, organizing the mitotic " +
                    "spindle during cell division, and building locomotory structures like " +
                    "cilia and flagella."
            },

            {
                heading: "Structure",
                body:
                    "It looks like a short, hollow straw or cylinder measuring roughly " +
                    "0.2 µm by 0.5 µm. Within the centrosome, two centrioles are positioned " +
                    "perpendicular (at a right angle) to each other. It is non-membranous " +
                    "and made of nine groups of microtubule triplets arranged in a strong " +
                    "ring, with each triplet containing A, B, and C tubulin tubules held " +
                    "together by specialized proteins and surrounded by a pericentriolar matrix."
            },

            {
                heading: "How It Works",
                body:
                    "It acts as a nucleating center. It anchors existing microtubules and " +
                    "uses molecular factors in its surrounding matrix to synthesize and " +
                    "grow new tubules outward. Free tubulin protein dimers and regulatory " +
                    "molecules enter its vicinity, and organized, hollow microtubule strands " +
                    "emerge outward to form mitotic spindle fibers and the basal bodies that " +
                    "extend into cilia and flagella. When the cell prepares to divide, " +
                    "centrioles replicate, split into two separate centrosomes, and migrate " +
                    "to opposite ends of the cell to pull chromosomes apart."
            },

            {
                heading: "Did You Know?",
                body:
                    "Unlike almost any other structural component in the cytoplasm, " +
                    "centrioles have the unique ability to self-replicate and make copies " +
                    "of themselves completely independently of other organelles."
            }

        ],

        sources: []

    },


    // ==================================================
    // CYTOPLASM
    // ==================================================

    cytoplasm: {

        title: "Cytoplasm",

        pronunciation: "sigh-toh-plaz-um",

        sections: [

            {
                heading: "What Is It?",
                body:
                    "The cytoplasm is not a single organelle. It is the entire viscous, " +
                    "gel-like internal compartment of the cell located between the outer " +
                    "plasma membrane and the nuclear envelope. It structurally supports " +
                    "the cell, houses all membrane-bound organelles, facilitates the " +
                    "movement of materials, and serves as the site for major chemical " +
                    "and metabolic reactions."
            },

            {
                heading: "Structure",
                body:
                    "It is made of cytosol, which is a water-based solution containing " +
                    "20 to 25 percent proteins, dissolved ions (sodium, potassium, calcium), " +
                    "simple sugars, amino acids, nucleic acids, and fatty acids, plus the " +
                    "suspended organelles and cytoskeletal fibers. Even though it is mostly " +
                    "water, it is so crowded with proteins and dissolved molecules that it " +
                    "acts more like a semi-solid gel than a liquid."
            },

            {
                heading: "How It Works",
                body:
                    "It acts as a physical medium, moving materials throughout the cell " +
                    "via diffusion and a circular churning motion called cyclosis (or " +
                    "cytoplasmic streaming). It is the direct site for glycolysis, which " +
                    "is the initial anaerobic breakdown of glucose. It is highly active in " +
                    "synthesizing organic materials like proteins, lipids, and nucleotides. " +
                    "Its viscosity changes dynamically. The peripheral layer near the " +
                    "membrane is typically clear and rigid, while the inner portion is " +
                    "granular, fluid, and highly metabolic."
            },

            {
                heading: "Did You Know?",
                body:
                    "The cytoplasm is the molecular soup of life where thousands of " +
                    "biochemical reactions take place simultaneously to keep our muscles " +
                    "moving, nerves communicating, and tissues growing."
            }

        ],

        sources: []

    },


    // ==================================================
    // CYTOSKELETON
    // ==================================================

    cytoskeleton: {

        title: "Cytoskeleton",

        pronunciation: "sigh-toh-skel-uh-tun",

        sections: [

            {
                heading: "What Is It?",
                body:
                    "The cytoskeleton is an intricate, non-membrane-bound network of " +
                    "structural protein fibers that spans the entire cytoplasm from the " +
                    "cell membrane to the nucleus. Its primary function is to maintain " +
                    "cell shape, structurally reinforce the cell, anchor organelles, and " +
                    "coordinate cell movement and internal transport."
            },

            {
                heading: "Structure",
                body:
                    "It is composed of three main protein-based filaments. These are " +
                    "microfilaments (thin actin fibers that resist tension), intermediate " +
                    "filaments (keratin-based, mid-sized fibers that anchor organelles and " +
                    "provide elasticity), and microtubules (thick, hollow tubulin cylinders " +
                    "that resist compression and serve as internal transit tracks)."
            },

            {
                heading: "How It Works",
                body:
                    "It operates dynamically by rapidly polymerizing (building) and " +
                    "depolymerizing (breaking down) its protein chains within minutes " +
                    "depending on the physical stress and needs of the cell. It anchors " +
                    "the nucleus in place, holds the Golgi apparatus in position, provides " +
                    "tracks for mitochondria and vesicles to travel on, and links with the " +
                    "cell membrane to create stable cell-to-cell junctions. In muscle cells, " +
                    "its actin filaments pair with myosin to drive rapid contractions. In " +
                    "dividing cells, its microtubules form the mitotic spindle."
            },

            {
                heading: "Did You Know?",
                body:
                    "Actin, the primary protein of microfilaments, is so crucial to " +
                    "life that it has remained almost entirely unchanged through millions " +
                    "of years of evolution and is the single most abundant protein in " +
                    "most eukaryotic cells."
            }

        ],

        sources: []

    },


    // ==================================================
    // GOLGI APPARATUS
    // ==================================================

    golgiApparatus: {

        title: "Golgi Apparatus",

        pronunciation: "gol-jee ap-uh-rat-us",

        sections: [

            {
                heading: "What Is It?",
                body:
                    "The Golgi apparatus (also known as the Golgi complex or Golgi body) " +
                    "is a single-membrane-bound eukaryotic organelle composed of a series " +
                    "of flattened, stacked membranous pouches called cisternae. It serves " +
                    "as the cellular shipping department. It receives proteins and lipids " +
                    "from the endoplasmic reticulum, chemically modifies them, sorts them, " +
                    "and packages them into vesicles for delivery to their proper destinations."
            },

            {
                heading: "Structure",
                body:
                    "It looks like a stack of flattened, pancake-shaped pouches supported " +
                    "by microtubules. Animal cells feature 4 to 10 stacked cisternae. It " +
                    "has a distinct polarity. There is a convex cis face (receiving side near " +
                    "the nucleus and ER) and a concave trans face (shipping side near the " +
                    "plasma membrane). It is made of a single-layer phospholipid bilayer " +
                    "membrane held in place by a structural protein matrix."
            },

            {
                heading: "How It Works",
                body:
                    "The cis face collects proteins and lipids arriving in transport vesicles " +
                    "from the ER. As cargo molecules migrate through the medial to the trans " +
                    "cisternae, they undergo stepwise chemical modifications such as " +
                    "glycosylation (attaching sugar chains) or phosphorylation (adding " +
                    "phosphate groups). They are then sorted in the trans-Golgi network " +
                    "and pinched off inside secretory vesicles for delivery to lysosomes, " +
                    "the plasma membrane, or for secretion outside the cell."
            },

            {
                heading: "Did You Know?",
                body:
                    "In plant cells, the Golgi apparatus is so versatile that it does not " +
                    "just package proteins. It actually builds the physical, structural " +
                    "carbohydrates (polysaccharides) that make up the surrounding cell wall."
            }

        ],

        sources: []

    },


    // ==================================================
    // LYSOSOME
    // ==================================================

    lysosome: {

        title: "Lysosome",

        pronunciation: "lie-suh-sohm",

        sections: [

            {
                heading: "What Is It?",
                body:
                    "The lysosome is a small, spherical, single-membrane-bound vesicle " +
                    "found primarily in animal cells that contains an array of highly " +
                    "acidic digestive enzymes. It serves as the cellular waste disposal " +
                    "and recycling facility. It digests old or damaged cellular components, " +
                    "breaks down food particles, and destroys foreign pathogens."
            },

            {
                heading: "Structure",
                body:
                    "It is made of a single lipoprotein membrane that isolates the " +
                    "dangerous interior from the rest of the cytoplasm. It encloses an " +
                    "acidic lumen packed with up to 40 to 50 different types of hydrolytic " +
                    "enzymes, including proteases, nucleases, glycosidases, phosphatases, " +
                    "and sulfatases."
            },

            {
                heading: "How It Works",
                body:
                    "It maintains an internal acidic pH of 5 using a specialized membrane-bound " +
                    "proton pump (ATPase) that actively pumps hydrogen ions (H+) from the " +
                    "neutral cytoplasm into the lysosome. This activates its hydrolytic " +
                    "enzymes to safely break down macromolecules into basic components like " +
                    "amino acids, simple sugars, and fatty acids that are recycled back " +
                    "into the cytosol. During periods of cellular starvation, lysosomes " +
                    "undergo autophagy. This means they digest the cell's own internal " +
                    "structures to supply raw nutrients for survival."
            },

            {
                heading: "Did You Know?",
                body:
                    "Its digestive enzymes are highly acid-loving. If a single lysosome " +
                    "leaks or bursts, the enzymes instantly deactivate in the neutral pH of " +
                    "the cytoplasm. This acts as a built-in safety switch to prevent the " +
                    "cell from accidentally digesting itself."
            }

        ],

        sources: []

    },


    // ==================================================
    // MITOCHONDRIA
    // ==================================================

    mitochondria: {

        title: "Mitochondria",

        pronunciation: "my-toh-kon-dree-uh",

        sections: [

            {
                heading: "What Is It?",
                body:
                    "Mitochondria are double-membrane-bound, semi-autonomous eukaryotic " +
                    "organelles suspended in the cytoplasm. Known as the powerhouse of " +
                    "the cell, they act as the cellular energy generator. They produce " +
                    "adenosine triphosphate (ATP) through aerobic cellular respiration " +
                    "to power all metabolic processes."
            },

            {
                heading: "Structure",
                body:
                    "They are typically rod-shaped, oval, or spherical structures measuring " +
                    "roughly 0.5 to 10 µm. They consist of two phospholipid bilayer " +
                    "membranes. There is a smooth outer membrane and an inner membrane " +
                    "folded into cristae to maximize surface area for chemical reactions. " +
                    "The inner membrane encloses a central fluid matrix containing circular " +
                    "mitochondrial DNA (mtDNA), enzymes, and ribosomes, along with " +
                    "protein complexes known as the Electron Transport Chain (ETC) " +
                    "and ATP synthase."
            },

            {
                heading: "How It Works",
                body:
                    "Nutrients undergo the Krebs cycle (TCA cycle) in the matrix, " +
                    "converting molecules into products utilized by the ETC. The ETC " +
                    "transfers electrons along protein components, pumping protons (H+) " +
                    "from the matrix into the intermembrane space to create a proton " +
                    "gradient. Protons then flow back into the matrix through ATP synthase, " +
                    "driving the phosphorylation of ADP to ATP. Nutrients (pyruvate, " +
                    "fatty acids) and oxygen go in, while ATP, carbon dioxide, and water " +
                    "come out."
            },

            {
                heading: "Did You Know?",
                body:
                    "According to the endosymbiotic theory, mitochondria were once completely " +
                    "independent, free-living aerobic bacteria that were engulfed by a larger " +
                    "ancestral cell millions of years ago. This formed a permanent, mutually " +
                    "beneficial relationship that persists to this day."
            }

        ],

        sources: []

    },


    // ==================================================
    // NUCLEUS
    // ==================================================

    nucleus: {

        title: "Nucleus",

        pronunciation: "nuc-lee-us",

        sections: [

            {
                heading: "What Is It?",
                body:
                    "The nucleus is a double-membrane-bound, spherical structure that acts " +
                    "as the primary control center and information warehouse of the eukaryotic " +
                    "cell. Its primary function is to house the cellular genetic blueprints " +
                    "(DNA), protect hereditary material, coordinate cell growth, direct cell " +
                    "replication, and manage gene expression and transcription."
            },

            {
                heading: "Structure",
                body:
                    "It is composed of a nuclear envelope, which is a double lipid bilayer " +
                    "continuous with the ER, punctuated by specialized nuclear pores that " +
                    "regulate transport. Inside, a gel-like nucleoplasm supports chromatin " +
                    "(a complex of thread-like DNA and structural histone proteins that " +
                    "condenses to form chromosomes during division) and the nucleolus (a " +
                    "dense, non-membrane-bound sub-region)."
            },

            {
                heading: "How It Works",
                body:
                    "The nucleus keeps DNA physically separated from cytoplasm enzymes to " +
                    "prevent genetic damage. It hosts transcription factors and enzymes close " +
                    "to the DNA, transcribing genetic instructions into mRNA. This mRNA " +
                    "undergoes capping and tailing modifications before traveling through " +
                    "nuclear pores into the cytoplasm for protein translation. Its nucleolus " +
                    "produces ribosomal RNA (rRNA) to construct ribosomes."
            },

            {
                heading: "Did You Know?",
                body:
                    "A human cell's DNA, which would stretch to about two meters long if " +
                    "laid end-to-end, is packed so tightly around histone proteins that " +
                    "it fits easily into a space less than one-tenth of a millimeter wide."
            }

        ],

        sources: []

    },


    // ==================================================
    // NUCLEOLUS
    // ==================================================

    Nucleolus: {

        title: "Nucleolus",

        pronunciation: "noo-klee-oh-lus",

        sections: [

            {
                heading: "What Is It?",
                body:
                    "The nucleolus is a dense, non-membrane-bound sub-region situated " +
                    "directly inside the nucleoplasm of the nucleus. Its primary function " +
                    "is to synthesize ribosomal RNA (rRNA) and combine it with imported " +
                    "proteins to assemble the subunits of ribosomes. These are the machines " +
                    "responsible for all protein synthesis in the cell."
            },

            {
                heading: "Structure",
                body:
                    "It appears as a dark, dense, highly condensed spherical region sitting " +
                    "inside the nucleus under a microscope. It lacks an outer membrane and " +
                    "is composed of a dense accumulation of ribosomal RNA (rRNA), ribosomal " +
                    "proteins, and specialized chromosomal DNA tracts containing " +
                    "ribosomal genes."
            },

            {
                heading: "How It Works",
                body:
                    "The nucleolus forms around specific chromosomes containing ribosomal " +
                    "DNA genes. It transcribes these genes into rRNA, imports ribosomal " +
                    "proteins from the cytoplasm through the nuclear pores, packages them " +
                    "together into small (40S) and large (60S) subunits, and exports them " +
                    "back into the cytoplasm to construct functional ribosomes. Its size " +
                    "and activity increase dramatically in highly metabolic cells that " +
                    "produce large amounts of proteins."
            },

            {
                heading: "Did You Know?",
                body:
                    "Even though the nucleolus performs some of the most complex structural " +
                    "construction in molecular biology, it is not a true organelle. It " +
                    "has no physical membrane separating it from the rest of the nucleus."
            }

        ],

        sources: []

    },


    // ==================================================
    // PEROXISOME
    // ==================================================

    peroxisome: {

        title: "Peroxisome",

        pronunciation: "per-ox-ih-sohm",

        sections: [

            {
                heading: "What Is It?",
                body:
                    "A peroxisome is a small, spherical, single-membrane-bound organelle " +
                    "(often classified as a microbody) suspended in the cytoplasm. Its " +
                    "primary functions include lipid metabolism (specifically the beta-oxidation " +
                    "of fatty acids), amino acid degradation, and chemical detoxification " +
                    "of metabolic poisons such as alcohol."
            },

            {
                heading: "Structure",
                body:
                    "It is a minute, circular vesicle measuring approximately 0.2 to " +
                    "1.5 micrometers in diameter. It is enclosed by a single lipid-protein " +
                    "unit membrane that encapsulates a dense core packed with oxidative " +
                    "enzymes such as oxidases and catalase."
            },

            {
                heading: "How It Works",
                body:
                    "Its oxidative enzymes strip hydrogen atoms from organic substrates " +
                    "and attach them to oxygen, generating hydrogen peroxide (H2O2) as " +
                    "a toxic byproduct. To protect the cell, the peroxisome immediately " +
                    "utilizes its catalase enzymes to convert H2O2 safely into harmless " +
                    "water (H2O) and oxygen (O2). In humans, peroxisomes are exceptionally " +
                    "abundant in liver cells to continuously detoxify the bloodstream, " +
                    "including neutralizing alcohol."
            },

            {
                heading: "Did You Know?",
                body:
                    "Unlike most organelles, peroxisomes contain no DNA of their own. " +
                    "This means they are completely unable to replicate themselves and must " +
                    "rely entirely on proteins imported from the nucleus to grow and multiply."
            }

        ],

        sources: []

    },


    // ==================================================
    // RIBOSOMES
    // ==================================================

    ribosomes: {

        title: "Ribosomes",

        pronunciation: "rye-buh-sohmz",

        sections: [

            {
                heading: "What Is It?",
                body:
                    "Ribosomes are small, dense, non-membrane-bound granules composed of " +
                    "ribosomal RNA (rRNA) and proteins that function as the protein synthesis " +
                    "machinery of the cell. Their primary function is translation. This means " +
                    "decoding genetic instructions delivered by messenger RNA (mRNA) to " +
                    "assemble amino acids into functional proteins."
            },

            {
                heading: "Structure",
                body:
                    "They appear as tiny, porous, spheroid dots under an electron microscope, " +
                    "consisting of two interlocking subunits. They are completely non-membranous " +
                    "and composed of roughly 60 percent ribosomal RNA (rRNA) and 40 percent " +
                    "ribosomal proteins. Eukaryotes contain 80S ribosomes (a 60S large subunit " +
                    "and 40S small subunit), while prokaryotic cells contain smaller 70S ribosomes."
            },

            {
                heading: "How It Works",
                body:
                    "The ribosome binds to an mRNA strand and reads the genetic codons " +
                    "three bases at a time, matching them with corresponding transfer RNA " +
                    "(tRNA) anticodons carrying amino acids. It utilizes peptidyl transferase " +
                    "to catalyze peptide bonds, weaving amino acids into a long polypeptide " +
                    "chain. Ribosomes are found either free-floating in the cytoplasm, " +
                    "synthesizing proteins for internal use, or bound to the rough ER and " +
                    "outer nuclear membrane to synthesize proteins packaged for transport."
            },

            {
                heading: "Did You Know?",
                body:
                    "A single, actively growing human cell can contain up to 10 million " +
                    "ribosomes, which collectively make up about a quarter of the cellular " +
                    "entire mass."
            }

        ],

        sources: []

    },


    // ==================================================
    // ENDOPLASMIC RETICULUM
    // ==================================================

    endoplasmicReticulum: {

        title: "Endoplasmic Reticulum",

        pronunciation: "en-doh-plaz-mik reh-tik-yuh-lum",

        sections: [

            {
                heading: "What Is It?",
                body:
                    "The endoplasmic reticulum (ER) is an extensive, continuous net-like " +
                    "network of folded membranous channels, tubules, and sacs that extends " +
                    "from the nuclear envelope throughout the cytoplasm. Its primary function " +
                    "is the synthesis, folding, modification, and transport of proteins " +
                    "and lipids."
            },

            {
                heading: "Structure",
                body:
                    "It is made of a continuous phospholipid bilayer membrane continuous " +
                    "with the nuclear envelope, enclosing an internal fluid channel space " +
                    "called the lumen. The ER is physically divided into two distinct " +
                    "regions. These are the Rough ER (RER), studded with ribosomes on its " +
                    "outer surface, and the Smooth ER (SER), which lacks ribosomes and is " +
                    "more tubular in form."
            },

            {
                heading: "How It Works",
                body:
                    "The Rough ER ribosomes translate proteins directly into the RER lumen, " +
                    "where enzymes fold them and attach sugar chains (glycosylation) before " +
                    "packaging them into transport vesicles for the Golgi apparatus. The " +
                    "Smooth ER houses enzymes that synthesize phospholipids and cholesterol, " +
                    "produce steroid hormones, store calcium ions critical for muscle " +
                    "contractions and nerve signaling, and chemically alter drugs and " +
                    "poisons to make them water-soluble for detoxification."
            },

            {
                heading: "Did You Know?",
                body:
                    "The ER is so extensive that its folded membranes account for more than " +
                    "half of the entire membranous content of a typical eukaryotic cell, " +
                    "providing a massive surface area for metabolic chemical reactions."
            }

        ],

        sources: []

    },


    // ==================================================
    // VACUOLE
    // ==================================================

    vacuole: {

        title: "Vacuole",

        pronunciation: "vak-yoo-ohl",

        sections: [

            {
                heading: "What Is It?",
                body:
                    "A vacuole is a membrane-bound, fluid-filled storage sac located in " +
                    "the cytoplasm of eukaryotic cells. Its primary function is to store " +
                    "water, nutrients, carbohydrates (sugars), and enzymes, while isolating " +
                    "toxic wastes and poorly folded proteins to protect the rest of the cell."
            },

            {
                heading: "Structure",
                body:
                    "It is enclosed by a single selectively permeable lipid bilayer membrane " +
                    "called the tonoplast, which encloses an interior solution of water, " +
                    "inorganic ions, organic acids, sugars, and pigment molecules (like " +
                    "anthocyanins). While mature plant cells have one massive central vacuole " +
                    "occupying up to 90 percent of cell volume, animal cells contain small, " +
                    "temporary, and numerous vacuoles scattered through the cytoplasm."
            },

            {
                heading: "How It Works",
                body:
                    "The surrounding tonoplast membrane utilizes active transport proteins " +
                    "and proton pumps to strictly control the passage of materials, locking " +
                    "nutrients and wastes inside the vacuole fluid matrix. Stored water, " +
                    "nutrients, and ions are released back into the cytoplasm as needed to " +
                    "maintain osmotic balance. In animal cells, vacuoles are primarily used " +
                    "for short-term storage and transport of food, water, and waste, as well " +
                    "as sequestering or removing toxic substances."
            },

            {
                heading: "Did You Know?",
                body:
                    "Vacuoles are incredibly dynamic. They can rapidly change their shape " +
                    "and size on demand to fulfill completely different survival roles " +
                    "depending on the immediate environmental stress of the cell."
            }

        ],

        sources: []

    }

};


// ======================================================
// HTML ELEMENTS
// ======================================================

const infoTitle = document.getElementById("infoTitle");
const infoPronunciation = document.getElementById("infoPronunciation");
const infoDefinition = document.getElementById("infoDefinition");
const speakButton = document.getElementById("speakButton");
const infoSources = document.getElementById("infoSources");

// ======================================================
// CURRENT ORGANELLE
// ======================================================

let currentOrganelle = null;

// ======================================================
// SCROLL INFORMATION PANEL TO TOP
// ======================================================

function scrollInfoToTop() {
    const infoPanel = document.querySelector(".div2");
    if (infoPanel) {
        infoPanel.scrollTo({ top: 0, behavior: "smooth" });
    }
}

// ======================================================
// RENDER SECTIONS
// ======================================================

function renderSections(sections) {
    if (!infoDefinition) return;
    if (!sections || sections.length === 0) {
        infoDefinition.textContent = "";
        return;
    }

    // First section starts expanded so the student sees an answer right
    // away; the rest start collapsed to keep the panel scannable.
    infoDefinition.innerHTML = sections.map((section, index) => `
        <div class="infoSection">
            <button type="button" class="infoSectionToggle" aria-expanded="${index === 0 ? "true" : "false"}">
                <h4 class="infoSectionHeading">${section.heading}</h4>
                <i class="bi bi-chevron-down infoSectionChevron" aria-hidden="true"></i>
            </button>
            <p class="infoSectionBody"${index === 0 ? "" : " hidden"}>${section.body}</p>
        </div>
    `).join("");
}

// ======================================================
// SECTION ACCORDION TOGGLE
// The container itself is never replaced (only its
// innerHTML), so one delegated listener here keeps
// working across every re-render triggered by
// updateOrganelleInformation / resetOrganelleInformation.
// ======================================================

if (infoDefinition) {
    infoDefinition.addEventListener("click", function (event) {
        const toggle = event.target.closest(".infoSectionToggle");
        if (!toggle) return;

        const body = toggle.nextElementSibling;
        if (!body || !body.classList.contains("infoSectionBody")) return;

        const isExpanded = toggle.getAttribute("aria-expanded") === "true";
        toggle.setAttribute("aria-expanded", String(!isExpanded));
        body.hidden = isExpanded;
    });
}

// ======================================================
// RENDER SOURCES
// ======================================================

function renderSources(sources) {
    if (!infoSources) return;

    if (!sources || sources.length === 0) {
        infoSources.style.display = "none";
        infoSources.innerHTML = "";
        return;
    }

    infoSources.style.display = "block";

    const listItems = sources.map((source, index) => {
        const number = index + 1;
        return `
            <li class="sourceItem">
                <span class="sourceNumber">${number}.</span>
                <span class="sourceText">
                    ${source.author} (${source.year}). <em>${source.title}</em>
                    <a href="${source.url}" target="_blank" rel="noopener noreferrer" class="sourceLink" title="Open source">
                        <i class="bi bi-box-arrow-up-right"></i>
                    </a>
                </span>
            </li>
        `;
    }).join("");

    infoSources.innerHTML = `
        <div class="sourcesHeader">
            <i class="bi bi-journal-text"></i> References
        </div>
        <ol class="sourcesList">${listItems}</ol>
    `;
}

// ======================================================
// UPDATE INFORMATION
// ======================================================

function updateOrganelleInformation(organelleName) {
    const information = organelleInformation[organelleName];
    if (!information) {
        console.warn("No information found for:", organelleName);
        return;
    }

    currentOrganelle = organelleName;

    if (infoTitle) infoTitle.textContent = information.title;

    if (infoPronunciation) {
        infoPronunciation.textContent = information.pronunciation || "";
        infoPronunciation.style.display = information.pronunciation ? "block" : "none";
    }

    if (speakButton) {
        speakButton.style.display = "flex";
        const icon = speakButton.querySelector("i");
        if (icon) {
            icon.classList.remove("bi-volume-up-fill");
            icon.classList.add("bi-volume-up");
        }
    }

    renderSections(information.sections);
    renderSources(information.sources);
    scrollInfoToTop();
}

// ======================================================
// RESET INFORMATION
// ======================================================

function resetOrganelleInformation() {
    const information = organelleInformation.animalCell;
    if (!information) {
        console.warn("Animal Cell information was not found.");
        return;
    }

    currentOrganelle = null;

    if (infoTitle) infoTitle.textContent = information.title;

    if (infoPronunciation) {
        infoPronunciation.textContent = "";
        infoPronunciation.style.display = "none";
    }

    if (speakButton) speakButton.style.display = "none";

    renderSections(information.sections);
    renderSources(information.sources);

    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }

    const infoPanel = document.querySelector(".div2");
    if (infoPanel) {
        infoPanel.scrollTo({ top: 0, behavior: "auto" });
    }
}

// ======================================================
// SPEAKER / PRONUNCIATION
// ======================================================

if (speakButton) {
    speakButton.addEventListener("click", function () {
        if (!currentOrganelle || !organelleInformation[currentOrganelle]) return;

        const information = organelleInformation[currentOrganelle];
        const text = information.title;

        if (!("speechSynthesis" in window)) return;

        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.85;
        utterance.pitch = 1;
        utterance.volume = 1;
        window.speechSynthesis.speak(utterance);
    });
}

// ======================================================
// MAKE FUNCTIONS AVAILABLE TO TREDII.JS
// ======================================================

window.updateOrganelleInformation = updateOrganelleInformation;
window.resetOrganelleInformation = resetOrganelleInformation;

// ======================================================
// INITIALIZE DEFAULT ANIMAL CELL INFORMATION
// ======================================================

resetOrganelleInformation();