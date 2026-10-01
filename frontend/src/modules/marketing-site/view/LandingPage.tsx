import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  Container,
  Paper,
  Stack,
  SvgIcon,
  Tabs,
  Tab,
  Typography,
} from "@mui/material";
import { PublicLayout } from "./PublicLayout";
import buildingSystemsGraphic from "@/assets/building-systems-graphic.svg";
import { PricingSection, faqs } from "./PricingPage";

const modes = [
  {
    id: "overview",
    label: "Operations",
    eyebrow: "THE DAY, IN ONE VIEW",
    title: "Harbor House",
    sub: "Your building, moving along.",
    items: [
      [
        "Lift service visit",
        "Common area · Vendor assigned",
        "Today",
        "#FBE5D9",
        "#A94F32",
      ],
      [
        "Water pressure check",
        "Unit 4B · In progress",
        "Open",
        "#E3EEF8",
        "#35698C",
      ],
      [
        "Hallway light repair",
        "Floor 3 · Completed",
        "Done",
        "#E5F0E6",
        "#39774A",
      ],
    ],
  },
  {
    id: "residents",
    label: "Residents",
    eyebrow: "THE PEOPLE, IN THE LOOP",
    title: "Resident center",
    sub: "A clearer line between home and team.",
    items: [
      [
        "Repair update",
        "Unit 4B · Technician assigned",
        "New",
        "#E3EEF8",
        "#35698C",
      ],
      [
        "Lease document",
        "Unit 2A · Ready to review",
        "Action",
        "#FBE5D9",
        "#A94F32",
      ],
      [
        "Move-in checklist",
        "Unit 5C · All items complete",
        "Done",
        "#E5F0E6",
        "#39774A",
      ],
    ],
  },
  {
    id: "finance",
    label: "Property records",
    eyebrow: "THE NUMBERS, CONNECTED",
    title: "Property ledger",
    sub: "Every charge tied to a place and a person.",
    items: [
      [
        "October rent",
        "Unit 4B · Payment recorded",
        "Paid",
        "#E5F0E6",
        "#39774A",
      ],
      [
        "Security deposit",
        "Unit 2A · Balance tracked",
        "Filed",
        "#E3EEF8",
        "#35698C",
      ],
      [
        "Service invoice",
        "Harbor House · Awaiting review",
        "Review",
        "#FBE5D9",
        "#A94F32",
      ],
    ],
  },
];

const capabilities = [
  [
    "01",
    "Your portfolio",
    "A clear map of buildings, floors, homes, shared spaces, and the history attached to them.",
  ],
  [
    "02",
    "Your people",
    "Keep households, leases, staff, vendors, and roles connected to the places they support.",
  ],
  [
    "03",
    "Your operations",
    "Coordinate requests, inspections, assets, and follow-through across the working day.",
  ],
  [
    "04",
    "Your finances",
    "Follow charges, rent, deposits, payments, and balances with a record behind every number.",
  ],
];

const day = [
  [
    "08:15",
    "The day comes into focus",
    "See open requests, occupancy, and the priorities waiting across your properties.",
  ],
  [
    "10:40",
    "The right person steps in",
    "Assign a repair, share context with a vendor, and keep the resident updated.",
  ],
  [
    "14:20",
    "Details find their place",
    "Record a payment, add an inspection note, or update a household's lease.",
  ],
  [
    "17:30",
    "The handoff is already there",
    "Leave a timeline your team can pick up tomorrow without starting over.",
  ],
];

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <SvgIcon aria-hidden="true" viewBox="0 0 24 24" sx={{ fontSize: 18 }}>
      <path
        d={diagonal ? "M7 17 17 7M8 7h9v9" : "M5 12h14m-6-6 6 6-6 6"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </SvgIcon>
  );
}

function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <Typography variant="overline" sx={{ color: "#B45B3D", display: "block" }}>
      {children}
    </Typography>
  );
}

function ScrollReveal({
  children,
  delay = 0,
}: {
  children: ReactNode;
  delay?: number;
}) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.unobserve(element);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -48px 0px" },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <Box
      ref={elementRef}
      sx={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(26px)",
        transition: `opacity 650ms ease ${delay}ms, transform 650ms cubic-bezier(.2,.75,.25,1) ${delay}ms`,
        "@media (prefers-reduced-motion: reduce)": {
          opacity: 1,
          transform: "none",
          transition: "none",
        },
      }}
    >
      {children}
    </Box>
  );
}

function ProductDemo() {
  const [active, setActive] = useState("overview");
  const mode = modes.find((item) => item.id === active) ?? modes[0];

  return (
    <Paper
      aria-label="Illustrative BuildEase workspace preview"
      sx={{
        position: "relative",
        maxWidth: 650,
        mx: "auto",
        p: { xs: 1.5, sm: 2.5 },
        borderRadius: 3.5,
        border: "1px solid rgba(37,58,54,.12)",
        bgcolor: "#FCFCF8",
        boxShadow: "0 28px 90px rgba(18,53,52,.16)",
        transform: { md: "rotate(-1deg)" },
        "@keyframes demo-in": {
          from: { opacity: 0, transform: "translateY(18px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        animation: "demo-in .85s .2s both",
      }}
    >
      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between", mb: 1.5 }}
      >
        <Stack direction="row" spacing={0.7} aria-hidden="true">
          {["#D98162", "#D8B36B", "#82A991"].map((color) => (
            <Box
              key={color}
              sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: color }}
            />
          ))}
        </Stack>
        <Typography
          variant="caption"
          sx={{ color: "#87938A", letterSpacing: ".04em" }}
        >
          APP.BUILDEASE / WORKSPACE
        </Typography>
        <Box sx={{ width: 32 }} />
      </Stack>
      <Box
        sx={{
          border: "1px solid #E5E9E1",
          borderRadius: 2.5,
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "145px 1fr" },
          minHeight: 340,
        }}
      >
        <Box
          sx={{
            display: { xs: "none", sm: "block" },
            p: 2,
            bgcolor: "#203F3D",
            color: "#F2F0E4",
          }}
        >
          <Stack
            direction="row"
            spacing={1}
            sx={{
              alignItems: "center",
              pb: 2,
              borderBottom: "1px solid rgba(255,255,255,.14)",
            }}
          >
            <Box
              sx={{
                width: 25,
                height: 25,
                display: "grid",
                placeItems: "center",
                borderRadius: 1.2,
                bgcolor: "#E9A271",
                color: "#203F3D",
                fontSize: 12,
                fontWeight: 900,
              }}
            >
              B
            </Box>
            <Typography
              variant="caption"
              sx={{ fontWeight: 800, letterSpacing: ".02em" }}
            >
              BuildEase
            </Typography>
          </Stack>
          <Stack spacing={0.7} sx={{ mt: 2 }}>
            {["Overview", "Properties", "People", "Operations", "Billing"].map(
              (item, index) => (
                <Stack
                  key={item}
                  direction="row"
                  spacing={1}
                  sx={{
                    alignItems: "center",
                    py: 0.7,
                    px: 0.8,
                    borderRadius: 1,
                    bgcolor:
                      index === 3 ? "rgba(255,255,255,.1)" : "transparent",
                    color: index === 3 ? "#F7BC91" : "#CAD7CB",
                  }}
                >
                  <Box
                    sx={{
                      width: 13,
                      height: 13,
                      border: "1px solid currentColor",
                      borderRadius: index === 2 ? "50%" : 0.5,
                      opacity: 0.8,
                    }}
                  />
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: index === 3 ? 750 : 500 }}
                  >
                    {item}
                  </Typography>
                </Stack>
              ),
            )}
          </Stack>
          <Box
            sx={{
              mt: 5,
              p: 1.1,
              borderRadius: 1.5,
              bgcolor: "rgba(255,255,255,.08)",
            }}
          >
            <Typography
              variant="caption"
              sx={{ display: "block", color: "#AFC6B6" }}
            >
              WORKSPACE
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              Harbor Group
            </Typography>
          </Box>
        </Box>
        <Box sx={{ minWidth: 0, p: { xs: 1.5, sm: 2.25 }, bgcolor: "white" }}>
          <Stack
            direction="row"
            sx={{
              justifyContent: "space-between",
              alignItems: "center",
              mb: 1.25,
            }}
          >
            <Box>
              <Typography variant="caption" sx={{ color: "#839087" }}>
                {mode.eyebrow}
              </Typography>
              <Typography variant="h6" sx={{ mt: 0.2, fontSize: 19 }}>
                {mode.title}
              </Typography>
            </Box>
            <Chip
              size="small"
              label="WORKSPACE VIEW"
              sx={{
                height: 23,
                bgcolor: "#E7F2E9",
                color: "#39774A",
                fontWeight: 800,
                fontSize: 9,
                letterSpacing: ".05em",
              }}
            />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {mode.sub}
          </Typography>
          <Tabs
            value={active}
            onChange={(_, value: string) => setActive(value)}
            variant="scrollable"
            scrollButtons={false}
            aria-label="Switch workspace preview"
            sx={{
              minHeight: 39,
              mt: 1,
              borderBottom: "1px solid #E9ECE6",
              "& .MuiTab-root": {
                minHeight: 39,
                px: 1.1,
                minWidth: 0,
                fontSize: 10,
                fontWeight: 750,
              },
              "& .MuiTabs-indicator": { bgcolor: "#C96E4A" },
            }}
          >
            {modes.map((item) => (
              <Tab key={item.id} value={item.id} label={item.label} />
            ))}
          </Tabs>
          <Stack direction="row" spacing={1} sx={{ mt: 1.4, mb: 1.4 }}>
            {[
              ["Homes", "128"],
              ["Open", "08"],
              ["People", "214"],
            ].map(([label, value]) => (
              <Box
                key={label}
                sx={{
                  flex: 1,
                  minWidth: 0,
                  p: 1,
                  borderRadius: 1.5,
                  bgcolor: "#F5F6F1",
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ display: "block", color: "#7B8980", fontSize: 9 }}
                >
                  {label}
                </Typography>
                <Typography
                  sx={{ fontSize: 16, fontWeight: 800, color: "#263E3A" }}
                >
                  {value}
                </Typography>
              </Box>
            ))}
          </Stack>
          <Stack spacing={0.8}>
            {mode.items.map(([title, detail, state, colorBg, color], index) => (
              <Stack
                key={title}
                direction="row"
                spacing={1}
                sx={{
                  alignItems: "center",
                  p: 1,
                  border: "1px solid #EDF0EB",
                  borderRadius: 1.5,
                  animation: `demo-in .35s ${index * 70}ms both`,
                }}
              >
                <Box
                  sx={{
                    width: 27,
                    height: 27,
                    flexShrink: 0,
                    display: "grid",
                    placeItems: "center",
                    borderRadius: 1,
                    bgcolor: colorBg,
                    color,
                  }}
                >
                  <Typography sx={{ fontSize: 12, fontWeight: 900 }}>
                    {index === 0 ? "↗" : index === 1 ? "•" : "✓"}
                  </Typography>
                </Box>
                <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                  <Typography
                    variant="caption"
                    sx={{ display: "block", fontWeight: 750 }}
                    noWrap
                  >
                    {title}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ display: "block", color: "#829087", fontSize: 9 }}
                    noWrap
                  >
                    {detail}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label={state}
                  sx={{
                    height: 21,
                    bgcolor: colorBg,
                    color,
                    fontSize: 9,
                    fontWeight: 750,
                    display: { xs: "none", sm: "inline-flex" },
                  }}
                />
              </Stack>
            ))}
          </Stack>
          <Typography
            variant="caption"
            sx={{
              display: "block",
              textAlign: "right",
              mt: 1,
              color: "#9AA59C",
              fontSize: 9,
            }}
          >
            Illustrative workspace preview
          </Typography>
        </Box>
      </Box>
      <Box
        aria-hidden="true"
        sx={{
          position: "absolute",
          right: { xs: 1, sm: -17 },
          top: { xs: 38, sm: 54 },
          px: 1.25,
          py: 0.9,
          borderRadius: 1.5,
          bgcolor: "#F4E4CE",
          boxShadow: "0 8px 22px rgba(28,57,51,.12)",
          animation: "gentle-float 4.5s ease-in-out infinite",
          "@keyframes gentle-float": {
            "0%, 100%": { transform: "translateY(0)" },
            "50%": { transform: "translateY(-7px)" },
          },
        }}
      >
        <Typography
          variant="caption"
          sx={{
            display: "flex",
            gap: 0.7,
            alignItems: "center",
            color: "#425C4C",
            fontWeight: 750,
          }}
        >
          <Box
            component="span"
            sx={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              bgcolor: "#6F9B72",
            }}
          />
          Update recorded
        </Typography>
      </Box>
    </Paper>
  );
}

function BuildingSystemsGraphic() {
  return (
    <Box
      component="img"
      src={buildingSystemsGraphic}
      alt="Isometric cutaway illustration of a connected apartment building and its operations"
      sx={{
        display: "block",
        width: "100%",
        maxWidth: 550,
        aspectRatio: "1 / 1",
        objectFit: "contain",
        mx: "auto",
        animation: "building-float 8s ease-in-out infinite",
        "@keyframes building-float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "@media (prefers-reduced-motion: reduce)": { animation: "none" },
      }}
    />
  );
}

export function LandingPage() {
  return (
    <PublicLayout>
      <Box
        sx={{
          "@keyframes marquee": {
            from: { transform: "translateX(0)" },
            to: { transform: "translateX(-50%)" },
          },
          "@keyframes intro-rise": {
            from: { opacity: 0, transform: "translateY(24px)" },
            to: { opacity: 1, transform: "translateY(0)" },
          },
          "@media (prefers-reduced-motion: reduce)": {
            "&, & *": {
              animationDuration: "0.01ms !important",
              animationIterationCount: "1 !important",
              scrollBehavior: "auto !important",
            },
          },
        }}
      >
        <Box
          sx={{
            position: "relative",
            overflow: "hidden",
            bgcolor: "#143534",
            color: "#F4F1E6",
            backgroundImage:
              "radial-gradient(ellipse at 77% 44%, rgba(202,111,77,.23), transparent 35%), linear-gradient(130deg, #143534, #1C4240 70%, #193B3A)",
            "&::before": {
              content: '""',
              position: "absolute",
              inset: 0,
              opacity: 0.08,
              backgroundImage:
                "linear-gradient(rgba(240,240,220,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(240,240,220,.4) 1px, transparent 1px)",
              backgroundSize: "52px 52px",
              maskImage: "linear-gradient(to bottom, black, transparent 90%)",
            },
          }}
        >
          <Container
            maxWidth="lg"
            sx={{
              position: "relative",
              px: { xs: 2, sm: 3 },
              pt: { xs: 6, md: 7 },
              pb: { xs: 5, md: 7 },
            }}
          >
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1.1fr .9fr" },
                gap: { xs: 3, md: 2 },
                alignItems: "center",
                minHeight: { md: 560 },
              }}
            >
              <Box
                sx={{
                  position: "relative",
                  zIndex: 1,
                  animation: "intro-rise .7s .05s both",
                }}
              >
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center", mb: 2.5 }}
                >
                  <Box sx={{ width: 26, height: 2, bgcolor: "#E9A16E" }} />
                  <Typography variant="overline" sx={{ color: "#D4B49B" }}>
                    BUILDING OPERATIONS, IN SYNC
                  </Typography>
                </Stack>
                <Typography
                  variant="h1"
                  sx={{
                    maxWidth: 680,
                    fontSize: { xs: 49, sm: 65, md: 78 },
                    lineHeight: 0.98,
                    letterSpacing: "-.07em",
                    color: "#F4F1E6",
                  }}
                >
                  A building is
                  <br />a world of its own.
                  <Box
                    component="span"
                    sx={{
                      display: "block",
                      mt: 0.6,
                      color: "#E9A16E",
                      fontFamily: "Georgia, serif",
                      fontWeight: 500,
                      fontStyle: "italic",
                    }}
                  >
                    Run it as one.
                  </Box>
                </Typography>
                <Typography
                  sx={{
                    mt: 2.7,
                    maxWidth: 485,
                    color: "#C5D4C8",
                    fontSize: { xs: 16, md: 18 },
                    lineHeight: 1.8,
                  }}
                >
                  The people, places, payments, and daily work all belong to the
                  same story. BuildEase helps your team see the connections and
                  keep things moving.
                </Typography>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.4}
                  sx={{ mt: 3.5 }}
                >
                  <Button
                    component={RouterLink}
                    to="/register"
                    variant="contained"
                    size="large"
                    endIcon={<Arrow />}
                    sx={{
                      bgcolor: "#E9A16E",
                      color: "#1D3937",
                      px: 2.5,
                      py: 1.7,
                      "&:hover": {
                        bgcolor: "#F1B384",
                        transform: "translateY(-2px)",
                      },
                      transition: "transform .2s, background-color .2s",
                    }}
                  >
                    Start your 14-day trial
                  </Button>
                  <Button
                    component="a"
                    href="/#platform"
                    endIcon={<Arrow diagonal />}
                    sx={{ color: "#EBE8D8", px: 1.5 }}
                  >
                    Explore the workspace
                  </Button>
                </Stack>
                <Stack
                  direction="row"
                  spacing={1.5}
                  sx={{ mt: 2.4, alignItems: "center", flexWrap: "wrap" }}
                >
                  <Typography variant="caption" sx={{ color: "#B7C9BE" }}>
                    No card required
                  </Typography>
                  <Box
                    sx={{
                      width: 3,
                      height: 3,
                      borderRadius: "50%",
                      bgcolor: "#E9A16E",
                    }}
                  />
                  <Typography variant="caption" sx={{ color: "#B7C9BE" }}>
                    Residents and vendors are free
                  </Typography>
                </Stack>
              </Box>
              <BuildingSystemsGraphic />
            </Box>
          </Container>
          <Box
            sx={{
              borderTop: "1px solid rgba(229,235,221,.15)",
              borderBottom: "1px solid rgba(229,235,221,.15)",
              py: 1.5,
              overflow: "hidden",
              bgcolor: "rgba(4,25,25,.18)",
            }}
          >
            <Box
              sx={{
                display: "flex",
                width: "max-content",
                animation: "marquee 38s linear infinite",
                "&:hover": { animationPlayState: "paused" },
              }}
            >
              {[0, 1].map((loop) => (
                <Stack
                  key={loop}
                  direction="row"
                  spacing={4}
                  sx={{ alignItems: "center", pr: 4 }}
                  aria-hidden={loop ? true : undefined}
                >
                  {[
                    "PROPERTY RECORDS",
                    "RESIDENT EXPERIENCE",
                    "MAINTENANCE",
                    "LEASING & PAYMENTS",
                    "TEAM WORKFLOWS",
                  ].map((label) => (
                    <Stack
                      key={label}
                      direction="row"
                      spacing={4}
                      sx={{ alignItems: "center" }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          whiteSpace: "nowrap",
                          color: "#BDCEC2",
                          letterSpacing: ".14em",
                          fontWeight: 800,
                        }}
                      >
                        {label}
                      </Typography>
                      <Box
                        component="span"
                        sx={{
                          width: 6,
                          height: 6,
                          bgcolor: "#E9A16E",
                          borderRadius: "50%",
                        }}
                      />
                    </Stack>
                  ))}
                </Stack>
              ))}
            </Box>
          </Box>
        </Box>

        <Box
          id="platform"
          sx={{
            scrollMarginTop: 90,
            py: { xs: 8, md: 12 },
            bgcolor: "#FCFCF8",
          }}
        >
          <ScrollReveal>
            <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 } }}>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: ".8fr 1.2fr" },
                  gap: { xs: 2, md: 8 },
                  alignItems: "end",
                  mb: 4,
                }}
              >
                <Box>
                  <SectionEyebrow>ONE BUILDING, FULLY CONNECTED</SectionEyebrow>
                  <Typography
                    variant="h2"
                    sx={{
                      mt: 1.2,
                      fontSize: { xs: 38, md: 55 },
                      letterSpacing: "-.055em",
                      lineHeight: 1.04,
                    }}
                  >
                    The work behind every address, connected.
                  </Typography>
                </Box>
                <Typography
                  sx={{
                    maxWidth: 500,
                    color: "#69786F",
                    lineHeight: 1.8,
                    fontSize: 16,
                  }}
                >
                  Buildings are made of interdependent details. BuildEase gives
                  your team a way to manage each one without losing sight of the
                  whole.
                </Typography>
              </Box>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                  borderTop: "1px solid #DDE2D8",
                  borderLeft: { sm: "1px solid #DDE2D8" },
                }}
              >
                {capabilities.map(([number, title, copy]) => (
                  <Box
                    key={number}
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "46px 1fr",
                      gap: 1.5,
                      p: { xs: 2.2, md: 3 },
                      borderRight: { sm: "1px solid #DDE2D8" },
                      borderBottom: "1px solid #DDE2D8",
                      transition: "background-color .25s",
                      "&:hover": { bgcolor: "#F3F3EA" },
                      "&:hover .cap-mark": {
                        color: "#C66B4A",
                        transform: "translateX(4px)",
                      },
                    }}
                  >
                    <Typography
                      className="cap-mark"
                      sx={{
                        color: "#7F9786",
                        fontSize: 12,
                        fontWeight: 850,
                        transition: "all .2s",
                      }}
                    >
                      {number}
                    </Typography>
                    <Box>
                      <Typography variant="h6">{title}</Typography>
                      <Typography
                        sx={{
                          mt: 0.7,
                          color: "#69786F",
                          lineHeight: 1.7,
                          fontSize: 14,
                        }}
                      >
                        {copy}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
              <Box sx={{ mt: { xs: 5, md: 7 } }}>
                <ProductDemo />
              </Box>
            </Container>
          </ScrollReveal>
        </Box>

        <Box
          id="workflow"
          sx={{
            scrollMarginTop: 90,
            py: { xs: 8, md: 12 },
            bgcolor: "#E9EBDD",
            color: "#243D37",
          }}
        >
          <ScrollReveal>
            <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 } }}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={3}
                sx={{
                  alignItems: { md: "end" },
                  justifyContent: "space-between",
                  mb: { xs: 5, md: 7 },
                }}
              >
                <Box>
                  <SectionEyebrow>A BETTER RHYTHM FOR THE DAY</SectionEyebrow>
                  <Typography
                    variant="h2"
                    sx={{
                      mt: 1.2,
                      fontSize: { xs: 39, md: 57 },
                      letterSpacing: "-.055em",
                      lineHeight: 1.02,
                    }}
                  >
                    From first look to
                    <br />
                    last handoff.
                  </Typography>
                </Box>
                <Typography
                  sx={{ maxWidth: 390, color: "#68776C", lineHeight: 1.8 }}
                >
                  The work does not happen in a straight line. BuildEase helps
                  your team keep the context as the day unfolds.
                </Typography>
              </Stack>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" },
                  borderTop: "1px solid #BFC9B9",
                  borderLeft: { md: "1px solid #BFC9B9" },
                }}
              >
                {day.map(([time, title, copy], index) => (
                  <Box
                    key={time}
                    sx={{
                      minHeight: { md: 275 },
                      p: { xs: 2.5, md: 2.4, lg: 3 },
                      borderRight: { md: "1px solid #BFC9B9" },
                      borderBottom: "1px solid #BFC9B9",
                      position: "relative",
                      overflow: "hidden",
                      "&:hover .time-dot": {
                        transform: "scale(1.5)",
                        bgcolor: "#C66B4A",
                      },
                    }}
                  >
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: "center", mb: 3 }}
                    >
                      <Box
                        className="time-dot"
                        sx={{
                          width: 9,
                          height: 9,
                          borderRadius: "50%",
                          bgcolor: "#3C7161",
                          transition: "transform .25s, background-color .25s",
                        }}
                      />
                      <Typography
                        variant="caption"
                        sx={{
                          color: "#718077",
                          fontWeight: 800,
                          letterSpacing: ".09em",
                        }}
                      >
                        {time}
                      </Typography>
                    </Stack>
                    <Typography
                      sx={{ color: "#B45B3D", fontSize: 12, fontWeight: 850 }}
                    >
                      0{index + 1}
                    </Typography>
                    <Typography variant="h5" sx={{ mt: 1, maxWidth: 220 }}>
                      {title}
                    </Typography>
                    <Typography
                      sx={{
                        mt: 1.2,
                        color: "#68776C",
                        lineHeight: 1.7,
                        fontSize: 14,
                      }}
                    >
                      {copy}
                    </Typography>
                    <Box
                      aria-hidden="true"
                      sx={{
                        position: "absolute",
                        width: 90,
                        height: 90,
                        right: -54,
                        bottom: -55,
                        border: "1px solid rgba(49,88,74,.3)",
                        borderRadius: "50%",
                        "&::after": {
                          content: '""',
                          position: "absolute",
                          inset: 13,
                          border: "1px solid rgba(49,88,74,.22)",
                          borderRadius: "50%",
                        },
                      }}
                    />
                  </Box>
                ))}
              </Box>
            </Container>
          </ScrollReveal>
        </Box>

        <Box
          sx={{
            py: { xs: 7, md: 10 },
            bgcolor: "#203E3B",
            color: "#F4F0E5",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <Box
            aria-hidden="true"
            sx={{
              position: "absolute",
              right: { xs: -170, md: -60 },
              top: -170,
              width: 440,
              height: 440,
              border: "1px solid rgba(244,240,229,.16)",
              borderRadius: "50%",
              "&::before, &::after": {
                content: '""',
                position: "absolute",
                inset: 24,
                border: "1px solid rgba(244,240,229,.14)",
                borderRadius: "50%",
              },
              "&::after": { inset: 55 },
            }}
          />
          <ScrollReveal>
            <Container
              maxWidth="lg"
              sx={{ position: "relative", px: { xs: 2, sm: 3 } }}
            >
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={3}
                sx={{
                  alignItems: { md: "center" },
                  justifyContent: "space-between",
                }}
              >
                <Box>
                  <Typography variant="overline" sx={{ color: "#DBA47E" }}>
                    FOR THE PEOPLE BEHIND THE PLACE
                  </Typography>
                  <Typography
                    variant="h2"
                    sx={{
                      mt: 1.2,
                      maxWidth: 680,
                      color: "#F4F0E5",
                      fontSize: { xs: 38, md: 54 },
                      lineHeight: 1.04,
                      letterSpacing: "-.05em",
                    }}
                  >
                    Everyone gets a better handoff.
                  </Typography>
                  <Typography
                    sx={{
                      mt: 1.5,
                      maxWidth: 580,
                      color: "#C5D2C6",
                      lineHeight: 1.75,
                    }}
                  >
                    Owners get the wider view. Teams get the next step.
                    Residents get updates that make home feel looked after.
                  </Typography>
                </Box>
                <Button
                  component={RouterLink}
                  to="/register"
                  variant="contained"
                  color="secondary"
                  size="large"
                  endIcon={<Arrow />}
                  sx={{ flexShrink: 0, px: 2.5, py: 1.7 }}
                >
                  See what changes
                </Button>
              </Stack>
            </Container>
          </ScrollReveal>
        </Box>

        <Box
          id="pricing"
          sx={{
            scrollMarginTop: 90,
            bgcolor: "#F3F0E6",
            py: { xs: 8, md: 12 },
          }}
        >
          <ScrollReveal>
            <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 } }}>
              <Box
                sx={{ textAlign: "center", maxWidth: 700, mx: "auto", mb: 5 }}
              >
                <SectionEyebrow>GET STARTED AT YOUR PACE</SectionEyebrow>
                <Typography
                  variant="h2"
                  sx={{
                    mt: 1.2,
                    fontSize: { xs: 39, md: 56 },
                    letterSpacing: "-.055em",
                  }}
                >
                  Start with one building.
                  <br />
                  See what opens up.
                </Typography>
                <Typography sx={{ mt: 1.5, color: "#69786F", lineHeight: 1.7 }}>
                  Try BuildEase for 14 days. No card required. Residents and
                  vendors are always free.
                </Typography>
              </Box>
              <PricingSection />
            </Container>
          </ScrollReveal>
        </Box>

        <Box
          id="questions"
          sx={{
            scrollMarginTop: 90,
            bgcolor: "#E9EBDD",
            py: { xs: 7, md: 10 },
          }}
        >
          <ScrollReveal>
            <Container maxWidth="md" sx={{ px: { xs: 2, sm: 3 } }}>
              <SectionEyebrow>THE DETAILS</SectionEyebrow>
              <Typography variant="h3" sx={{ mt: 1 }}>
                A few things you might be wondering.
              </Typography>
              <Box sx={{ mt: 2.5 }}>
                {faqs.map((faq) => (
                  <Accordion
                    key={faq.question}
                    disableGutters
                    sx={{
                      bgcolor: "transparent",
                      borderBottom: "1px solid #C9D1C4",
                      "&::before": { display: "none" },
                    }}
                  >
                    <AccordionSummary
                      expandIcon={
                        <Typography sx={{ color: "#B45B3D", fontSize: 22 }}>
                          +
                        </Typography>
                      }
                      sx={{ px: 0 }}
                    >
                      <Typography sx={{ fontWeight: 720 }}>
                        {faq.question}
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails sx={{ px: 0, pt: 0 }}>
                      <Typography
                        sx={{
                          maxWidth: 680,
                          color: "#68776C",
                          lineHeight: 1.75,
                        }}
                      >
                        {faq.answer}
                      </Typography>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Box>
              <Button
                component={RouterLink}
                to="/pricing"
                endIcon={<Arrow diagonal />}
                sx={{ mt: 2, px: 0, color: "#A95439" }}
              >
                Explore plans and details
              </Button>
            </Container>
          </ScrollReveal>
        </Box>
      </Box>
    </PublicLayout>
  );
}
