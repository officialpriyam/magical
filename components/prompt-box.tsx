import { PromptInputBox } from "@/components/ui/ai-prompt-box";
import { LLMModel, LLMModelConfig } from "@/lib/models";
import models from "@/lib/models.json";
import templates, { TemplateId } from "@/lib/templates";
import { useState } from "react";

const PromptBox = () => {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId | "auto">("auto");
  const [languageModel, setLanguageModel] = useState<LLMModelConfig>({
    model: models.models[0].id,
  });

  const handleSendMessage = (message: string, files?: File[]) => {
    console.log("Message:", message);
    console.log("Files:", files);
  };

  const handleLanguageModelChange = (modelConfig: LLMModelConfig) => {
    setLanguageModel(modelConfig);
  };

  const filteredModels = models.models as LLMModel[];

  return (
    <div className="p-4 w-[500px]">
      <PromptInputBox
        onSend={handleSendMessage}
        templates={templates}
        selectedTemplate={selectedTemplate}
        onSelectedTemplateChange={setSelectedTemplate}
        models={filteredModels}
        languageModel={languageModel}
        onLanguageModelChange={handleLanguageModelChange}
        apiKeyConfigurable={!process.env.NEXT_PUBLIC_NO_API_KEY_INPUT}
        baseURLConfigurable={!process.env.NEXT_PUBLIC_NO_BASE_URL_INPUT}
      />
    </div>
  );
};

export { PromptBox };