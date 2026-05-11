type PlaceholderWorkspaceScreenProps = {
  title: string;
  description: string;
};

export function PlaceholderWorkspaceScreen({ title, description }: PlaceholderWorkspaceScreenProps) {
  return (
    <div className="flex-1 flex flex-col bg-[#F7F9FC] overflow-auto">
      <div className="bg-white border-b border-[#E5E9F2] px-6 py-6">
        <h1 className="text-2xl text-[#1F2937]">{title}</h1>
        <p className="text-[#6B7280] mt-1">{description}</p>
      </div>

      <div className="flex-1 p-6 lg:p-8 overflow-auto">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-2xl shadow-sm border border-[#E5E9F2] p-6">
            <h2 className="text-lg text-[#1F2937] mb-4">{title}</h2>
            <p className="text-sm text-[#6B7280]">{description}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
