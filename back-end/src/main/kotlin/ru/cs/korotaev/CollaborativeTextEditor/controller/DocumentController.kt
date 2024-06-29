package ru.cs.korotaev.CollaborativeTextEditor.controller

import org.springframework.messaging.handler.annotation.MessageMapping
import org.springframework.messaging.handler.annotation.SendTo
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController
import ru.cs.korotaev.CollaborativeTextEditor.model.DocumentUpdate
import ru.cs.korotaev.CollaborativeTextEditor.service.DocumentService

@RestController
class DocumentController(private val documentService: DocumentService) {

    @MessageMapping("/updateDocument")
    @SendTo("/topic/updates")
    fun updateDocument(update: DocumentUpdate): DocumentUpdate {
        return documentService.updateDocument(update)
    }

    @GetMapping("/api/getDocument")
    fun getDocument(): DocumentUpdate {
        return DocumentUpdate(documentService.getDocumentContent())
    }

}