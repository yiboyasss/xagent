import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select } from "@/components/ui/select"
import { useI18n } from "@/contexts/i18n-context"
import {
  AlertCircle,
  CheckCircle,
  ChevronRight,
  Folder,
  File
} from "lucide-react"
import { toast } from "sonner"

export interface CloudFile {
  id: string
  name: string
  type: 'file' | 'folder'
  size?: string
  updatedAt?: string
}

interface CloudConnectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  provider: string | null
  initialSelectedIds?: string[]
  onConfirm: (selectedFiles: CloudFile[]) => void
}

export function CloudConnectDialog({
  open,
  onOpenChange,
  provider,
  initialSelectedIds = [],
  onConfirm
}: CloudConnectDialogProps) {
  const { t } = useI18n()

  // Internal state
  // const [authStep, setAuthStep] = useState<'auth' | 'select'>('auth') // Removed separate auth step
  const [cloudUser, setCloudUser] = useState<string | null>(null)
  const [selectedDrive, setSelectedDrive] = useState<string>("my-drive")
  const [currentPath, setCurrentPath] = useState<string[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false) // New state for auth popup

  // Mock file system
  const mockFileSystem: Record<string, CloudFile[]> = {
    "root": [
      { id: '1', name: 'Project Specs', type: 'folder', updatedAt: '2023-10-01' },
      { id: '2', name: 'Meeting Notes.docx', type: 'file', size: '1.2 MB', updatedAt: '2023-10-02' },
      { id: '3', name: 'Budget.xlsx', type: 'file', size: '450 KB', updatedAt: '2023-10-03' },
      { id: '4', name: 'Design Assets', type: 'folder', updatedAt: '2023-10-04' },
      { id: '5', name: 'Product Roadmap.pdf', type: 'file', size: '2.5 MB', updatedAt: '2023-10-05' },
      { id: '6', name: 'Client Contracts', type: 'folder', updatedAt: '2023-10-06' },
    ],
    "Project Specs": [
      { id: '11', name: 'Technical Requirements.pdf', type: 'file', size: '2.1 MB', updatedAt: '2023-10-01' },
      { id: '12', name: 'UI-UX Guidelines.pdf', type: 'file', size: '5.4 MB', updatedAt: '2023-10-01' },
    ],
    "Design Assets": [
      { id: '41', name: 'Logo Pack', type: 'folder', updatedAt: '2023-10-04' },
      { id: '42', name: 'Banner.png', type: 'file', size: '1.2 MB', updatedAt: '2023-10-04' },
    ],
    "Logo Pack": [
      { id: '411', name: 'Logo-Light.svg', type: 'file', size: '12 KB', updatedAt: '2023-10-04' },
      { id: '412', name: 'Logo-Dark.svg', type: 'file', size: '12 KB', updatedAt: '2023-10-04' },
    ],
    "Client Contracts": [
      { id: '61', name: 'Service Agreement.docx', type: 'file', size: '45 KB', updatedAt: '2023-10-06' },
      { id: '62', name: 'NDA.pdf', type: 'file', size: '1.2 MB', updatedAt: '2023-10-06' },
    ]
  }

  const getCurrentFiles = () => {
    const currentFolder = currentPath.length > 0 ? currentPath[currentPath.length - 1] : "root"
    return mockFileSystem[currentFolder] || []
  }

  const cloudFiles = getCurrentFiles()

  const driveOptions = [
    { value: "my-drive", label: "My Drive" },
    { value: "shared-drive-1", label: "Shared Drives - Marketing" },
    { value: "shared-drive-2", label: "Shared Drives - Engineering" },
  ]

  // Sync initial selection when opening
  useEffect(() => {
    if (open) {
      setSelectedIds(initialSelectedIds)
    }
  }, [open, initialSelectedIds])

  const handleConfirm = () => {
    // Collect all selected files from the entire mock file system
    const allFiles = Object.values(mockFileSystem).flat()
    const selectedFiles = allFiles.filter(file => selectedIds.includes(file.id))
    onConfirm(selectedFiles)
    onOpenChange(false)
  }

  const handleCancel = () => {
    // Reset selection to initial on cancel? Or just close?
    // Usually cancel means discard changes.
    setSelectedIds(initialSelectedIds)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] h-[80vh] max-h-[700px] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {t("kb.dialog.cloudConnect.auth.title", {
              provider: provider === 'google-drive' ? t("kb.dialog.cloudConnect.googleDrive") : (provider || "")
            })}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col space-y-4 py-4">
          {/* Account Selection Section */}
          <div className="space-y-2">
            <Label>{t("kb.dialog.cloudConnect.auth.selectAccount")}</Label>
            <Select
              value={cloudUser || "add_new"}
              onValueChange={(value) => {
                if (value === "add_new") {
                  setIsAuthDialogOpen(true)
                } else {
                  setCloudUser(value)
                }
              }}
              options={[
                ...(cloudUser ? [{ value: cloudUser, label: cloudUser }] : []),
                { value: "add_new", label: t("kb.dialog.cloudConnect.auth.addAccount") }
              ]}
            />
          </div>

          {/* Drive and File Selection - Only show if user is connected */}
          {cloudUser ? (
            <div className="flex-1 flex flex-col space-y-4 min-h-0">
              {/* Drive Select */}
              <div className="space-y-2">
                <Label>{t("kb.dialog.cloudConnect.select.driveLabel")}</Label>
                <Select
                  value={selectedDrive}
                  onValueChange={setSelectedDrive}
                  options={driveOptions}
                />
              </div>

              {/* File List */}
              <div className="space-y-2 flex-1 flex flex-col min-h-0">
                <Label>{t("kb.dialog.cloudConnect.select.folderLabel")}</Label>
                <div className="flex-1 border rounded-md flex flex-col min-h-0">
                  {/* Breadcrumbs Mock */}
                  <div className="flex items-center gap-1 text-sm text-muted-foreground p-2 border-b">
                    <span
                      className="hover:underline cursor-pointer"
                      onClick={() => setCurrentPath([])}
                    >
                      {driveOptions.find(o => o.value === selectedDrive)?.label || selectedDrive}
                    </span>
                    {currentPath.map((folder, index) => (
                      <div key={index} className="flex items-center gap-1">
                        <ChevronRight size={14} />
                        <span
                          className={`hover:underline cursor-pointer ${index === currentPath.length - 1 ? "font-medium text-foreground" : ""}`}
                          onClick={() => setCurrentPath(prev => prev.slice(0, index + 1))}
                        >
                          {folder}
                        </span>
                      </div>
                    ))}
                  </div>

                  <ScrollArea className="flex-1 overflow-auto">
                    <div className="p-2 space-y-1">
                      {cloudFiles.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded cursor-pointer group"
                          onClick={() => {
                            if (file.type === 'folder') {
                              setCurrentPath(prev => [...prev, file.name])
                            } else {
                              // Toggle selection
                              setSelectedIds(prev =>
                                prev.includes(file.id)
                                  ? prev.filter(id => id !== file.id)
                                  : [...prev, file.id]
                              )
                            }
                          }}
                        >
                          <div className="flex items-center justify-center w-5 h-5">
                            {file.type === 'file' && (
                              <div className={`w-4 h-4 border rounded flex items-center justify-center ${
                                selectedIds.includes(file.id) ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground"
                              }`}>
                                {selectedIds.includes(file.id) && <CheckCircle className="h-3 w-3" />}
                              </div>
                            )}
                          </div>
                          {file.type === 'folder' ? (
                            <Folder className="h-5 w-5 text-blue-400" />
                          ) : (
                            <File className="h-5 w-5 text-gray-400" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{file.name}</div>
                            <div className="text-xs text-muted-foreground flex gap-2">
                              {file.size && <span>{file.size}</span>}
                              <span>{file.updatedAt}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
                <div className="text-xs text-muted-foreground text-right pt-1">
                  {t("kb.dialog.cloudConnect.select.selectedCount", { count: selectedIds.length })}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg bg-muted/10">
              <AlertCircle className="h-10 w-10 mb-2 opacity-50" />
              <p>{t("kb.dialog.cloudConnect.auth.noAccount")}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t mt-auto">
          <Button variant="outline" onClick={handleCancel}>
            {t("kb.dialog.cloudConnect.select.cancel")}
          </Button>
          <Button onClick={handleConfirm} disabled={!cloudUser || selectedIds.length === 0}>
            {t("kb.dialog.cloudConnect.select.confirm")}
          </Button>
        </div>

        {/* Auth Dialog (Nested) */}
        <Dialog open={isAuthDialogOpen} onOpenChange={setIsAuthDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("kb.dialog.cloudConnect.auth.connectNew")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg flex items-center gap-3 text-sm text-blue-700 dark:text-blue-300">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p>{t("kb.dialog.cloudConnect.auth.connectDescription", {
                  provider: provider === 'google-drive' ? t("kb.dialog.cloudConnect.googleDrive") : (provider || "")
                })}</p>
              </div>
              <div className="space-y-2">
                <Label>{t("kb.dialog.cloudConnect.auth.apiKeyLabel")}</Label>
                <Input type="password" placeholder="ya29.a0..." />
              </div>
              <Button onClick={() => {
                setCloudUser("demo-user@example.com")
                setIsAuthDialogOpen(false)
              }} className="w-full">
                {t("kb.dialog.cloudConnect.auth.connectButton")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  )
}
