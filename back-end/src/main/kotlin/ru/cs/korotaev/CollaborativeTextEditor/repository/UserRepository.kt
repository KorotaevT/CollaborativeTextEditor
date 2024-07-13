package ru.cs.korotaev.CollaborativeTextEditor.repository

import org.springframework.data.jpa.repository.JpaRepository
import ru.cs.korotaev.CollaborativeTextEditor.model.User
import java.util.Optional

interface UserRepository : JpaRepository<User, Int> {

    fun findByUsername(username: String?): Optional<User>

    fun findAllByRoleName(roleName: String?): List<User>

    fun findById(id: Long?): Optional<User>

}