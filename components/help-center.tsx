"use client"

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Code, 
  Terminal, 
  Zap, 
  Database, 
  Settings, 
  BookOpen, 
  Lightbulb,
  PlayCircle,
  GitBranch,
  Shield,
  Rocket,
  HelpCircle,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  Info
} from 'lucide-react'
import { useState } from 'react'

interface HelpModalProps {
  trigger?: React.ReactNode
  defaultOpen?: boolean
}

export function HelpModal({ trigger, defaultOpen = false }: HelpModalProps) {
  const [open, setOpen] = useState(defaultOpen)

  const defaultTrigger = (
    <Button variant="outline" size="sm">
      <HelpCircle className="w-4 h-4 mr-2" />
      Help
    </Button>
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-5xl h-[80vh] p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center mr-3">
              <HelpCircle className="w-5 h-5 text-primary" />
            </div>
            AI App Builder - Help Center
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1 px-6">
          <div className="py-4">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-6 mb-6">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="fragments">Fragments</TabsTrigger>
                <TabsTrigger value="models">AI Models</TabsTrigger>
                <TabsTrigger value="sandbox">Sandbox</TabsTrigger>
                <TabsTrigger value="deployment">Deploy</TabsTrigger>
                <TabsTrigger value="troubleshooting">Help</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <Card className="h-full">
                    <CardHeader className="pb-3">
                      <div className="flex items-center space-x-2">
                        <Zap className="w-5 h-5 text-primary" />
                        <CardTitle className="text-lg">Getting Started</CardTitle>
                      </div>
                      <CardDescription className="text-sm">
                        Build AI-powered applications with our fragment-based system
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground mb-3">
                        Start creating applications by chatting with our AI assistant. Choose from multiple frameworks and let AI generate production-ready code.
                      </p>
                      <div className="space-y-1">
                        <div className="flex items-center text-sm">
                          <CheckCircle className="w-3 h-3 text-green-500 mr-2 flex-shrink-0" />
                          Next.js, Vue.js, Streamlit, Gradio
                        </div>
                        <div className="flex items-center text-sm">
                          <CheckCircle className="w-3 h-3 text-green-500 mr-2 flex-shrink-0" />
                          Real-time code execution
                        </div>
                        <div className="flex items-center text-sm">
                          <CheckCircle className="w-3 h-3 text-green-500 mr-2 flex-shrink-0" />
                          Multiple AI providers
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="h-full">
                    <CardHeader className="pb-3">
                      <div className="flex items-center space-x-2">
                        <Terminal className="w-5 h-5 text-primary" />
                        <CardTitle className="text-lg">E2B Sandbox</CardTitle>
                      </div>
                      <CardDescription className="text-sm">
                        Secure, isolated execution environment
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground mb-3">
                        All code runs in secure E2B sandboxes with 10-minute execution timeout and full package installation support.
                      </p>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="secondary" className="text-xs">Node.js</Badge>
                        <Badge variant="secondary" className="text-xs">Python</Badge>
                        <Badge variant="secondary" className="text-xs">npm/pip</Badge>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="h-full">
                    <CardHeader className="pb-3">
                      <div className="flex items-center space-x-2">
                        <Database className="w-5 h-5 text-primary" />
                        <CardTitle className="text-lg">Templates</CardTitle>
                      </div>
                      <CardDescription className="text-sm">
                        Pre-configured development environments
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground mb-3">
                        Choose from optimized templates for different use cases and frameworks.
                      </p>
                      <div className="space-y-1 text-sm">
                        <div>📊 <strong>Data Analysis:</strong> Python, pandas</div>
                        <div>⚛️ <strong>Next.js:</strong> React, TypeScript</div>
                        <div>🖼️ <strong>Streamlit:</strong> Dashboards</div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Alert>
                  <Lightbulb className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Pro Tip:</strong> Start by describing what you want to build. Our AI will automatically select the best template and generate optimized code for your use case.
                  </AlertDescription>
                </Alert>
              </TabsContent>

              {/* Fragments Tab */}
              <TabsContent value="fragments" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                      <Code className="w-5 h-5 mr-2" />
                      Understanding Fragments
                    </CardTitle>
                    <CardDescription>
                      Fragments are self-contained, executable code units that run in E2B sandboxes
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div>
                        <h4 className="font-semibold mb-3">Available Templates</h4>
                        <div className="space-y-2">
                          <div className="border rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-sm">code-interpreter-v1</span>
                              <Badge variant="outline" className="text-xs">Python</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mb-1">
                              Data analysis, visualization, machine learning
                            </p>
                            <div className="text-xs text-muted-foreground">
                              pandas, numpy, matplotlib, seaborn, plotly, scipy
                            </div>
                          </div>

                          <div className="border rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-sm">nextjs-developer</span>
                              <Badge variant="outline" className="text-xs">TypeScript</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mb-1">
                              Full-stack web applications with React
                            </p>
                            <div className="text-xs text-muted-foreground">
                              Port: 3000 | Next.js 14+, TypeScript, Tailwind
                            </div>
                          </div>

                          <div className="border rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-sm">streamlit-developer</span>
                              <Badge variant="outline" className="text-xs">Python</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mb-1">
                              Interactive web apps and dashboards
                            </p>
                            <div className="text-xs text-muted-foreground">
                              Port: 8501 | Auto-reloading, session state
                            </div>
                          </div>

                          <div className="border rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-sm">gradio-developer</span>
                              <Badge variant="outline" className="text-xs">Python</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mb-1">
                              ML model interfaces and demos
                            </p>
                            <div className="text-xs text-muted-foreground">
                              Port: 7860 | Gradio Blocks/Interface
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-3">Fragment Schema</h4>
                        <div className="bg-muted rounded-lg p-3 text-sm font-mono">
                          <div className="space-y-1">
                            <div><span className="text-blue-600">title:</span> string</div>
                            <div><span className="text-blue-600">description:</span> string</div>
                            <div><span className="text-blue-600">template:</span> string</div>
                            <div><span className="text-blue-600">file_path:</span> string</div>
                            <div><span className="text-blue-600">code:</span> string</div>
                            <div><span className="text-blue-600">port:</span> number | null</div>
                            <div><span className="text-blue-600">dependencies:</span> string[]</div>
                          </div>
                        </div>

                        <Alert className="mt-3">
                          <Info className="h-4 w-4" />
                          <AlertDescription className="text-sm">
                            Fragments automatically include commentary explaining the code and implementation decisions.
                          </AlertDescription>
                        </Alert>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* AI Models Tab */}
              <TabsContent value="models" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                      <Zap className="w-5 h-5 mr-2" />
                      Supported AI Providers
                    </CardTitle>
                    <CardDescription>
                      Multiple AI providers for different use cases and requirements
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      <div className="border rounded-lg p-3">
                        <h4 className="font-semibold flex items-center mb-2 text-sm">
                          <div className="w-5 h-5 bg-green-100 dark:bg-green-900 rounded mr-2 flex items-center justify-center">
                            <CheckCircle className="w-3 h-3 text-green-600 dark:text-green-400" />
                          </div>
                          OpenAI
                        </h4>
                        <p className="text-xs text-muted-foreground mb-2">
                          GPT-4, GPT-3.5 Turbo with function calling
                        </p>
                        <Badge variant="outline" className="text-xs">Most Popular</Badge>
                      </div>

                      <div className="border rounded-lg p-3">
                        <h4 className="font-semibold flex items-center mb-2 text-sm">
                          <div className="w-5 h-5 bg-purple-100 dark:bg-purple-900 rounded mr-2 flex items-center justify-center">
                            <CheckCircle className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                          </div>
                          Anthropic
                        </h4>
                        <p className="text-xs text-muted-foreground mb-2">
                          Claude 3.5 Sonnet, Claude 3 Opus
                        </p>
                        <Badge variant="outline" className="text-xs">High Quality</Badge>
                      </div>

                      <div className="border rounded-lg p-3">
                        <h4 className="font-semibold flex items-center mb-2 text-sm">
                          <div className="w-5 h-5 bg-blue-100 dark:bg-blue-900 rounded mr-2 flex items-center justify-center">
                            <CheckCircle className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                          </div>
                          Google AI
                        </h4>
                        <p className="text-xs text-muted-foreground mb-2">
                          Gemini Pro, Vertex AI integration
                        </p>
                        <Badge variant="outline" className="text-xs">Multimodal</Badge>
                      </div>

                      <div className="border rounded-lg p-3">
                        <h4 className="font-semibold flex items-center mb-2 text-sm">
                          <div className="w-5 h-5 bg-orange-100 dark:bg-orange-900 rounded mr-2 flex items-center justify-center">
                            <CheckCircle className="w-3 h-3 text-orange-600 dark:text-orange-400" />
                          </div>
                          Groq
                        </h4>
                        <p className="text-xs text-muted-foreground mb-2">
                          Ultra-fast inference speeds
                        </p>
                        <Badge variant="outline" className="text-xs">Fastest</Badge>
                      </div>

                      <div className="border rounded-lg p-3">
                        <h4 className="font-semibold flex items-center mb-2 text-sm">
                          <div className="w-5 h-5 bg-gray-100 dark:bg-gray-800 rounded mr-2 flex items-center justify-center">
                            <CheckCircle className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                          </div>
                          Others
                        </h4>
                        <p className="text-xs text-muted-foreground mb-2">
                          Mistral, Fireworks, Together AI, xAI, DeepSeek, Ollama
                        </p>
                        <Badge variant="outline" className="text-xs">Variety</Badge>
                      </div>
                    </div>

                    <Alert className="mt-4">
                      <Settings className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        Configure API keys in the chat settings. You can switch between providers during conversations to find the best model for your specific use case.
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Sandbox Tab */}
              <TabsContent value="sandbox" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                      <Terminal className="w-5 h-5 mr-2" />
                      E2B Sandbox Environment
                    </CardTitle>
                    <CardDescription>
                      Secure, isolated execution environment for AI-generated code
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <h4 className="font-semibold mb-2">Environment Capabilities</h4>
                        <div className="space-y-1">
                          <div className="flex items-center text-sm">
                            <CheckCircle className="w-3 h-3 text-green-500 mr-2 flex-shrink-0" />
                            Node.js runtime with npm packages
                          </div>
                          <div className="flex items-center text-sm">
                            <CheckCircle className="w-3 h-3 text-green-500 mr-2 flex-shrink-0" />
                            Python 3.19+ with pip packages
                          </div>
                          <div className="flex items-center text-sm">
                            <CheckCircle className="w-3 h-3 text-green-500 mr-2 flex-shrink-0" />
                            Real-time terminal access
                          </div>
                          <div className="flex items-center text-sm">
                            <CheckCircle className="w-3 h-3 text-green-500 mr-2 flex-shrink-0" />
                            File upload and management
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-2">Limitations</h4>
                        <div className="space-y-1">
                          <div className="flex items-center text-sm">
                            <AlertTriangle className="w-3 h-3 text-yellow-500 mr-2 flex-shrink-0" />
                            10-minute execution timeout
                          </div>
                          <div className="flex items-center text-sm">
                            <AlertTriangle className="w-3 h-3 text-yellow-500 mr-2 flex-shrink-0" />
                            No native binary compilation
                          </div>
                          <div className="flex items-center text-sm">
                            <AlertTriangle className="w-3 h-3 text-yellow-500 mr-2 flex-shrink-0" />
                            Git is not available
                          </div>
                          <div className="flex items-center text-sm">
                            <AlertTriangle className="w-3 h-3 text-yellow-500 mr-2 flex-shrink-0" />
                            No persistent storage
                          </div>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h4 className="font-semibold mb-3">Template Configuration</h4>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="bg-muted rounded-lg p-3">
                          <h5 className="font-medium mb-2 text-sm">Next.js Template</h5>
                          <div className="text-xs space-y-1">
                            <div><strong>ID:</strong> scwxnhs1apt5uj7na7db</div>
                            <div><strong>CPU:</strong> 4 cores, <strong>Memory:</strong> 4GB</div>
                          </div>
                        </div>

                        <div className="bg-muted rounded-lg p-3">
                          <h5 className="font-medium mb-2 text-sm">Streamlit Apps</h5>
                          <div className="text-xs space-y-1">
                            <div><strong>Port:</strong> 8501</div>
                            <div><strong>Auto-reload:</strong> Enabled</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Deployment Tab */}
              <TabsContent value="deployment" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                      <Rocket className="w-5 h-5 mr-2" />
                      Deployment Options
                    </CardTitle>
                    <CardDescription>
                      Deploy your AI-generated applications to production
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        Applications run in E2B sandboxes during development. Export your code for production deployment.
                      </AlertDescription>
                    </Alert>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="border rounded-lg p-3">
                        <h4 className="font-semibold mb-2 flex items-center text-sm">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Vercel
                        </h4>
                        <p className="text-xs text-muted-foreground mb-2">
                          Perfect for Next.js applications
                        </p>
                        <div className="space-y-1 text-xs">
                          <div>✓ Zero-config deployment</div>
                          <div>✓ Automatic HTTPS</div>
                          <div>✓ Edge functions</div>
                        </div>
                      </div>

                      <div className="border rounded-lg p-3">
                        <h4 className="font-semibold mb-2 flex items-center text-sm">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Streamlit Cloud
                        </h4>
                        <p className="text-xs text-muted-foreground mb-2">
                          Built for Streamlit applications
                        </p>
                        <div className="space-y-1 text-xs">
                          <div>✓ GitHub integration</div>
                          <div>✓ Automatic updates</div>
                          <div>✓ Sharing capabilities</div>
                        </div>
                      </div>

                      <div className="border rounded-lg p-3">
                        <h4 className="font-semibold mb-2 flex items-center text-sm">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Hugging Face Spaces
                        </h4>
                        <p className="text-xs text-muted-foreground mb-2">
                          Perfect for ML demos
                        </p>
                        <div className="space-y-1 text-xs">
                          <div>✓ ML-focused platform</div>
                          <div>✓ Model integration</div>
                          <div>✓ Community showcase</div>
                        </div>
                      </div>

                      <div className="border rounded-lg p-3">
                        <h4 className="font-semibold mb-2 flex items-center text-sm">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Railway / Render
                        </h4>
                        <p className="text-xs text-muted-foreground mb-2">
                          Full-stack with databases
                        </p>
                        <div className="space-y-1 text-xs">
                          <div>✓ Database hosting</div>
                          <div>✓ Environment variables</div>
                          <div>✓ Custom domains</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Troubleshooting Tab */}
              <TabsContent value="troubleshooting" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                      <HelpCircle className="w-5 h-5 mr-2" />
                      Common Issues & Solutions
                    </CardTitle>
                    <CardDescription>
                      Resolve common problems and optimize your experience
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="border rounded-lg p-3">
                        <h4 className="font-semibold text-red-600 mb-2 text-sm">Fragment Execution Timeout</h4>
                        <p className="text-xs text-muted-foreground mb-2">
                          Fragment execution stops after 10 minutes
                        </p>
                        <div className="space-y-1 text-xs">
                          <div><strong>Solution:</strong> Optimize code for faster execution</div>
                          <div>• Reduce data processing complexity</div>
                          <div>• Use efficient algorithms and libraries</div>
                          <div>• Break large tasks into smaller fragments</div>
                        </div>
                      </div>

                      <div className="border rounded-lg p-3">
                        <h4 className="font-semibold text-yellow-600 mb-2 text-sm">Package Installation Failures</h4>
                        <p className="text-xs text-muted-foreground mb-2">
                          Dependencies fail to install in sandbox
                        </p>
                        <div className="space-y-1 text-xs">
                          <div><strong>Solution:</strong> Use compatible packages</div>
                          <div>• Stick to pure Python/JavaScript packages</div>
                          <div>• Avoid packages requiring compilation</div>
                          <div>• Check template-specific library lists</div>
                        </div>
                      </div>

                      <div className="border rounded-lg p-3">
                        <h4 className="font-semibold text-blue-600 mb-2 text-sm">Preview Not Loading</h4>
                        <p className="text-xs text-muted-foreground mb-2">
                          Application preview does not display correctly
                        </p>
                        <div className="space-y-1 text-xs">
                          <div><strong>Solution:</strong> Check port configuration</div>
                          <div>• Verify correct port in template settings</div>
                          <div>• Check terminal output for errors</div>
                          <div>• Refresh the preview panel</div>
                        </div>
                      </div>

                      <div className="border rounded-lg p-3">
                        <h4 className="font-semibold text-purple-600 mb-2 text-sm">AI Model Errors</h4>
                        <p className="text-xs text-muted-foreground mb-2">
                          API errors or unexpected responses
                        </p>
                        <div className="space-y-1 text-xs">
                          <div><strong>Solution:</strong> Check API configuration</div>
                          <div>• Verify API keys are correct</div>
                          <div>• Try alternative AI providers</div>
                          <div>• Simplify complex prompts</div>
                        </div>
                      </div>
                    </div>

                    <Alert className="mt-4">
                      <Shield className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        <strong>Security Note:</strong> All code execution happens in isolated E2B sandboxes. Avoid including sensitive data like API keys in your code.
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}