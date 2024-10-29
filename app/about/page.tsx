import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Music, Code, Gamepad, Heart, Zap, Layers, Palette, Radio, Music2, Bot } from "lucide-react"
export default function AboutPage() {
  const teamMembers = [
    { name: "Taylor Rupe", role: "Full-stack Developer", avatar: "/placeholder.svg?height=100&width=100" },
    { name: "Elissa Hada", role: "TBD", avatar: "/placeholder.svg?height=100&width=100" },
    { name: "Stephanie Garcia", role: "TBD", avatar: "/placeholder.svg?height=100&width=100" },
    { name: "Shubhank Gwayali", role: "TBD", avatar: "/placeholder.svg?height=100&width=100" },
  ]

  const funFacts = [
    "We originally were going to build a 3-D Escape Room but pivoted to SongTrivia.Us instead.",
    "Elissa was already working with the Spotify API for a separate class before we switched to SongTrivia.Us.",
    "Chat GPT 4o randomly selects the songs for each game!",
    
  ]

  const techStack = [
    { name: "Next.js", icon: Zap, description: "React framework for building fast and scalable web applications" },
    { name: "Tailwind CSS", icon: Palette, description: "Utility-first CSS framework for rapid UI development" },
    { name: "shadcn/ui", icon: Layers, description: "Beautifully designed components built with Radix UI and Tailwind CSS" },
    { name: "Socket.io", icon: Radio, description: "Real-time, bidirectional and event-based communication" },
    { name: "Spotify API", icon: Music2, description: "Access to Spotify's music catalog" },
    { name: "OpenAI API", icon: Bot, description: "AI-powered features and natural language processing" },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-600 to-blue-600 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center">About Song Trivia</CardTitle>
            <CardDescription className="text-center text-lg">An Oregon State University Capstone Project</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-center text-lg">
              Song Trivia is a fun and interactive way to test your music knowledge. Created as a Capstone Project, our
              team has poured their hearts (and ears) into making this the ultimate music quiz experience!
            </p>
            <div className="flex justify-center space-x-4">
              <Badge variant="secondary" className="flex items-center space-x-1">
                <Music className="w-4 h-4" />
                <span>Music Lovers</span>
              </Badge>
              <Badge variant="secondary" className="flex items-center space-x-1">
                <Code className="w-4 h-4" />
                <span>Tech Enthusiasts</span>
              </Badge>
              <Badge variant="secondary" className="flex items-center space-x-1">
                <Gamepad className="w-4 h-4" />
                <span>Gamers</span>
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">Meet the Team</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              {teamMembers.map((member) => (
                <div key={member.name} className="flex flex-col items-center text-center">
                  <Avatar className="w-24 h-24 mb-2">
                    <AvatarImage src={member.avatar} alt={member.name} />
                    <AvatarFallback>{member.name[0]}</AvatarFallback>
                  </Avatar>
                  <h3 className="font-semibold">{member.name}</h3>
                  <p className="text-sm text-gray-600">{member.role}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">Our Tech Stack</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {techStack.map((tech) => (
                <div key={tech.name} className="flex items-start space-x-3 p-3 rounded-lg bg-gray-100">
                  <tech.icon className="w-6 h-6 text-purple-600 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold">{tech.name}</h3>
                    <p className="text-sm text-gray-600">{tech.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      /
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">Fun Facts</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {funFacts.map((fact, index) => (
                <li key={index} className="flex items-start">
                  <Heart className="w-5 h-5 mr-2 text-red-500 flex-shrink-0 mt-1" />
                  <span>{fact}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="text-center text-white">
          <p className="text-lg font-semibold">Made with <Heart className="inline w-5 h-5 text-red-500" /> and lots of <Music className="inline w-5 h-5" /></p>
          <p className="mt-2">© 2024 SongTrivia.Us Team. All rights reserved.</p>
        </div>
      </div>
    </div>
  )
}