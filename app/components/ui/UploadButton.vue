<template>
    <div class="upload-control inline-flex shrink-0">
        <input
            ref="fileInput"
            type="file"
            class="file-input hidden"
            multiple
            :accept="accept"
            :webkitdirectory="mode === 'folder' ? '' : undefined"
            :disabled="disabled"
            @change="handleFileChange"
        />

        <slot name="trigger" :open-picker="openPicker" :disabled="disabled">
            <UButton
                type="button"
                :color="variant === 'secondary' ? 'neutral' : 'primary'"
                :variant="variant === 'secondary' ? 'outline' : 'solid'"
                leading-icon="solar:cloud-upload-linear"
                :label="$msg(text)"
                class="h-10 justify-center whitespace-nowrap px-3 max-mobile:h-11 pointer-coarse:h-11"
                :disabled="disabled"
                @click="openPicker"
            />
        </slot>
    </div>
</template>

<script setup lang="ts">
const props = withDefaults(
    defineProps<{
        text?: string
        mode?: 'file' | 'folder'
        accept?: string
        disabled?: boolean
        variant?: 'primary' | 'secondary'
    }>(),
    {
        text: 'Upload',
        mode: 'file',
        variant: 'primary'
    }
)

const emit = defineEmits<{
    files: [files: FileList]
    folder: [files: FileList]
}>()

const fileInput = ref<HTMLInputElement | null>(null)

const openPicker = () => {
    if (props.disabled) return

    fileInput.value?.click()
}

const handleFileChange = (event: Event) => {
    const input = event.target as HTMLInputElement

    if (props.disabled || !input.files?.length) return

    if (props.mode === 'folder') emit('folder', input.files)
    else emit('files', input.files)

    input.value = ''
}
</script>
